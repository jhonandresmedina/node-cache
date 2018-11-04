const express = require('express');
const responseTime = require('response-time');
const axios = require('axios');
const redis = require('redis');

const app = express();

const client = redis.createClient();

client.on('error', error => {
    console.log('Error ' + error);
});

app.use(responseTime());

const cache = (request, response, next) => {
    const query = (request.query.query).trim();
    return client.get(`wikipedia:${query}`, (error, result) => {
        if (error) {
            return response.json(error);
        } else if (result) {
            const resultJson = JSON.parse(result);
            return response.status(200).json(resultJson);
        } else {
            next();
        }
    });
}

app.get('/api/search', cache, (request, response) => {
    const query = (request.query.query).trim();
    const searchURL = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;

    return axios.get(searchURL)
        .then(searchResponse => {
            const responseJson = searchResponse.data;
            client.setex(`wikipedia:${query}`, 3600, JSON.stringify({source: 'Redis Cache', ...responseJson}))
            return response.status(200).json({source:'Wikipedia API', ...responseJson})
        })
        .catch(error => {
            return response.json(error);
        });
});

app.listen(3000, () => {
    console.log('Server listening on port: ', 3000);
});
