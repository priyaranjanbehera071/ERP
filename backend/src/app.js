const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/sales-orders', require('./routes/orders'));

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err.code === '23514') return res.status(409).json({ error: 'Change rejected: it would break an inventory/data rule' });
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate record' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
module.exports = app;
