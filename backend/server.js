const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mount all API routes under /api
app.use('/api', require('./routes/api'));

// Global error handler (catches anything not handled in controllers)
app.use((err, req, res, _next) => {
  console.error('[UnhandledError]', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(PORT, () =>
  console.log(`[Server] Debt Tracker API running on http://localhost:${PORT}`)
);

module.exports = app;
