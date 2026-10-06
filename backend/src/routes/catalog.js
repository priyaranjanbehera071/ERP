const router = require('express').Router();
const { query } = require('../db');
const { h, bad, HttpError } = require('../util');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/products', h(async (_req, res) => {
  res.json((await query('SELECT * FROM products ORDER BY code')).rows);
}));

// Both roles can view availability. available is derived, never stored.
router.get('/inventory', h(async (_req, res) => {
  const { rows } = await query(
    `SELECT p.id AS product_id, p.code, p.name, p.unit, i.physical_qty, i.reserved_qty,
            (i.physical_qty - i.reserved_qty) AS available_qty
     FROM inventory i JOIN products p ON p.id = i.product_id ORDER BY p.code`);
  res.json(rows);
}));

// Admin sets physical stock. DB CHECK constraints reject negatives / physical < reserved.
router.put('/inventory/:productId', authorize('ADMIN'), h(async (req, res) => {
  const qty = req.body?.physical_qty;
  if (!Number.isInteger(qty) || qty < 0) throw bad('physical_qty must be a non-negative integer');
  const { rows } = await query(
    `UPDATE inventory SET physical_qty=$1, updated_at=now() WHERE product_id=$2 RETURNING *`,
    [qty, req.params.productId]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
}));
module.exports = router;
