const express = require('express');
const client = require('prom-client');
const app = express();
const PORT = process.env.PORT || 4444;

client.collectDefaultMetrics();

const httpRequests = new client.Counter({
 name: 'http_requests_total',
 help: 'Total number of HTTP requests',
 labelNames: ['method', 'route', 'status_code'],
});
const httpDuration = new client.Histogram({
 name: 'http_request_duration_seconds',
 help: 'Duration of HTTP requests in seconds',
 labelNames: ['method', 'route', 'status_code'],
 buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
const inFlight = new client.Gauge({
 name: 'http_requests_in_flight',
 help: 'Number of requests currently being processed',
});

app.use((req, res, next) => {
 if (req.path === '/metrics') return next();
 const stop = httpDuration.startTimer();
 inFlight.inc();
 res.on('finish', () => {
 const route = req.route ? req.route.path : 'unmatched';
 const labels = { method: req.method, route, status_code: res.statusCode };
 httpRequests.inc(labels);
 stop(labels);
 inFlight.dec();
 });
 next();
});

app.get('/', (req, res) => res.send('Hello from the lab Node.js app!\n'));

app.get('/slow', (req, res) => {
 const delay = 200 + Math.random() * 1300;
 setTimeout(() => res.send('Slow response after ' + Math.round(delay) + ' ms\n'), delay);
});

app.get('/error', (req, res) => {
 if (Math.random() < 0.5) return res.status(500).send('Random failure\n');
 res.send('Lucky, no failure\n');
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/metrics', async (req, res) => {
 res.set('Content-Type', client.register.contentType);
 res.end(await client.register.metrics());
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));