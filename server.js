// flyflex-barebone/server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Homepage con il form di ricerca
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// POST: Ricerca voli standard con date e orari
app.post('/search-flights', async (req, res) => {
  const { from, to, dates, time_min, time_max } = req.body;
  const token = await getAccessToken();
  const dateArray = dates.split(',');
  let results = [];

  for (let date of dateArray) {
    try {
      const response = await axios.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          originLocationCode: from,
          destinationLocationCode: to,
          departureDate: date.trim(),
          adults: 1,
          max: 5,
        }
      });

      const filtered = response.data.data.filter(flight => {
        const time = flight.itineraries[0].segments[0].departure.at.split('T')[1];
        return time >= time_min && time <= time_max;
      });

      results.push(...filtered);
    } catch (err) {
      console.error('Errore nella richiesta API:', err.message);
    }
  }

  res.send(`<h2>Risultati</h2><pre>${JSON.stringify(results, null, 2)}</pre><a href="/">Torna indietro</a>`);
});

// POST: Ricerca voli da più aeroporti senza destinazione, su più date, con filtro orario
app.post('/multi-origin-advanced', async (req, res) => {
  const { airports, dates, time_min, time_max } = req.body;
  const token = await getAccessToken();
  const airportList = airports.split(',');
  const dateArray = dates.split(',');
  let results = [];

  for (let origin of airportList) {
    for (let date of dateArray) {
      try {
        const destRes = await axios.get('https://test.api.amadeus.com/v1/shopping/flight-destinations', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            origin: origin.trim(),
            departureDate: date.trim(),
          }
        });

        for (let dest of destRes.data.data) {
          try {
            const offerRes = await axios.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
              headers: { Authorization: `Bearer ${token}` },
              params: {
                originLocationCode: origin.trim(),
                destinationLocationCode: dest.destination,
                departureDate: date.trim(),
                adults: 1,
                max: 1
              }
            });

            const filtered = offerRes.data.data.filter(flight => {
              const time = flight.itineraries[0].segments[0].departure.at.split('T')[1];
              return time >= time_min && time <= time_max;
            });

            if (filtered.length > 0) {
              results.push({
                origin: origin.trim(),
                destination: dest.destination,
                date: date.trim(),
                offer: filtered[0]
              });
            }
          } catch (err) {
            console.error(`Errore dettagli volo da ${origin} a ${dest.destination}:`, err.message);
          }
        }
      } catch (err) {
        console.error('Errore multi-origin advanced:', err.message);
      }
    }
  }

  res.send(`<h2>Voli trovati da più aeroporti con filtro orario</h2><pre>${JSON.stringify(results, null, 2)}</pre><a href="/">Torna indietro</a>`);
});

async function getAccessToken() {
  const response = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', null, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    params: {
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET
    }
  });
  return response.data.access_token;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server in ascolto su http://localhost:${PORT}`));

/*
Struttura cartelle:
- flyflex-barebone/
  - server.js
  - .env
  - package.json
  - public/
    - index.html
*/
