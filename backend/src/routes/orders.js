const router = require('express').Router();
const { query, tx } = require('../db');
const { h, bad, HttpError } = require('../util');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const SELECT = `
  SELECT so.*, c.company_name, q.quotation_no, e.enquiry_no, d.dispatch_no, d.vehicle_no, d.driver_name, d.dispatch_date,
   (SELECT json_agg(json_build_object('product_id', i.product_id, 'code', p.code, 'name', p.name,
      'quantity', i.quantity, 'unit_price', i.unit_price, 'line_amount', i.line_amount,
      'reserved_qty', i.reserved_qty, 'available_qty', inv.physical_qty - inv.reserved_qty) ORDER BY i.id)
    FROM sales_order_items i JOIN products p ON p.id = i.product_id
    JOIN inventory inv ON inv.product_id = i.product_id WHERE i.order_id = so.id) AS items
  FROM sales_orders so JOIN customers c ON c.id = so.customer_id
  JOIN quotations q ON q.id = so.quotation_id JOIN enquiries e ON e.id = q.enquiry_id
  LEFT JOIN dispatches d ON d.order_id = so.id`;

router.get('/', h(async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const { rows } = await query(`${SELECT} WHERE ($1::boolean OR so.created_by=$2) ORDER BY so.id DESC`, [admin, req.user.id]);
  res.json(rows);
}));

// Locks the order row, then its inventory rows in product_id order (consistent order => no deadlocks).
async function lockOrder(db, id) {
  const so = (await db.query('SELECT * FROM sales_orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!so) throw new HttpError(404, 'Sales order not found');
  const items = (await db.query('SELECT * FROM sales_order_items WHERE order_id=$1 ORDER BY product_id', [id])).rows;
  const inv = (await db.query(
    'SELECT * FROM inventory WHERE product_id = ANY($1::int[]) ORDER BY product_id FOR UPDATE',
    [items.map((i) => i.product_id)])).rows;
  return { so, items, inv: Object.fromEntries(inv.map((r) => [r.product_id, r])) };
}

router.post('/:id/confirm', authorize('ADMIN'), h(async (req, res) => {
  await tx(async (db) => {
    const { so, items, inv } = await lockOrder(db, req.params.id);
    if (so.status !== 'PENDING') throw new HttpError(409, `Only PENDING orders can be confirmed (this one is ${so.status})`);
    const short = items.filter((i) => inv[i.product_id].physical_qty - inv[i.product_id].reserved_qty < i.quantity)
      .map((i) => ({ product_id: i.product_id, required: i.quantity,
                     available: inv[i.product_id].physical_qty - inv[i.product_id].reserved_qty }));
    if (short.length) {
      const err = new HttpError(409, 'Insufficient stock to confirm this order');
      err.details = short; throw err;
    }
    for (const i of items) {
      await db.query('UPDATE inventory SET reserved_qty = reserved_qty + $1, updated_at=now() WHERE product_id=$2', [i.quantity, i.product_id]);
      await db.query('UPDATE sales_order_items SET reserved_qty=$1 WHERE id=$2', [i.quantity, i.id]);
    }
    await db.query(`UPDATE sales_orders SET status='CONFIRMED', confirmed_at=now() WHERE id=$1`, [so.id]);
  });
  res.json((await query(`${SELECT} WHERE so.id=$1`, [req.params.id])).rows[0]);
}));

router.post('/:id/cancel', authorize('ADMIN'), h(async (req, res) => {
  await tx(async (db) => {
    const { so, items } = await lockOrder(db, req.params.id);
    if (!['PENDING', 'CONFIRMED'].includes(so.status)) throw new HttpError(409, `A ${so.status} order cannot be cancelled`);
    for (const i of items.filter((x) => x.reserved_qty > 0)) {   // release reservations
      await db.query('UPDATE inventory SET reserved_qty = reserved_qty - $1, updated_at=now() WHERE product_id=$2', [i.reserved_qty, i.product_id]);
      await db.query('UPDATE sales_order_items SET reserved_qty=0 WHERE id=$1', [i.id]);
    }
    await db.query(`UPDATE sales_orders SET status='CANCELLED' WHERE id=$1`, [so.id]);
  });
  res.json((await query(`${SELECT} WHERE so.id=$1`, [req.params.id])).rows[0]);
}));

router.post('/:id/dispatch', authorize('ADMIN'), h(async (req, res) => {
  const { vehicle_no, driver_name } = req.body || {};
  if (!vehicle_no?.trim() || !driver_name?.trim()) throw bad('Vehicle number and driver name are required');
  await tx(async (db) => {
    const { so, items } = await lockOrder(db, req.params.id);
    if (so.status === 'DISPATCHED') throw new HttpError(409, 'This order has already been dispatched');
    if (so.status !== 'CONFIRMED') throw new HttpError(409, `Only CONFIRMED orders can be dispatched (this one is ${so.status})`);
    const d = await db.query(
      `INSERT INTO dispatches (order_id,vehicle_no,driver_name,dispatched_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [so.id, vehicle_no.trim(), driver_name.trim(), req.user.id]);
    for (const i of items) {
      if (i.reserved_qty <= 0) throw new HttpError(409, 'Nothing reserved for dispatch');
      // Dispatch exactly what was reserved: physical AND reserved both go down.
      await db.query('UPDATE inventory SET physical_qty = physical_qty - $1, reserved_qty = reserved_qty - $1, updated_at=now() WHERE product_id=$2', [i.reserved_qty, i.product_id]);
      await db.query('INSERT INTO dispatch_items (dispatch_id,product_id,quantity) VALUES ($1,$2,$3)', [d.rows[0].id, i.product_id, i.reserved_qty]);
      await db.query('UPDATE sales_order_items SET reserved_qty=0 WHERE id=$1', [i.id]);
    }
    await db.query(`UPDATE sales_orders SET status='DISPATCHED' WHERE id=$1`, [so.id]);
  });
  res.json((await query(`${SELECT} WHERE so.id=$1`, [req.params.id])).rows[0]);
}));
module.exports = router;
