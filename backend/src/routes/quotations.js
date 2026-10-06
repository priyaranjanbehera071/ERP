const router = require('express').Router();
const { query, tx } = require('../db');
const { h, bad, posInt, HttpError } = require('../util');
const { authenticate, authorize } = require('../middleware/auth');
const { totals } = require('../calc');

router.use(authenticate);

const SELECT = `
  SELECT q.*, c.company_name, e.enquiry_no, so.order_no, so.id AS order_id,
   (SELECT json_agg(json_build_object('product_id', i.product_id, 'code', p.code, 'name', p.name,
      'quantity', i.quantity, 'unit_price', i.unit_price, 'discount_pct', i.discount_pct,
      'gst_pct', i.gst_pct, 'line_amount', i.line_amount) ORDER BY i.id)
    FROM quotation_items i JOIN products p ON p.id = i.product_id WHERE i.quotation_id = q.id) AS items
  FROM quotations q JOIN customers c ON c.id = q.customer_id JOIN enquiries e ON e.id = q.enquiry_id
  LEFT JOIN sales_orders so ON so.quotation_id = q.id`;

router.get('/', h(async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const { rows } = await query(`${SELECT} WHERE ($1::boolean OR q.created_by=$2) ORDER BY q.id DESC`, [admin, req.user.id]);
  res.json(rows);
}));

router.post('/', authorize('SALES'), h(async (req, res) => {
  const { enquiry_id, valid_until, items } = req.body || {};
  if (!posInt(enquiry_id)) throw bad('enquiry_id is required');
  if (!valid_until || isNaN(Date.parse(valid_until))) throw bad('Valid until date is invalid');
  if (new Date(valid_until) < new Date(new Date().toDateString())) throw bad('Valid until cannot be in the past');
  if (!Array.isArray(items) || !items.length) throw bad('Add at least one item');

  const id = await tx(async (db) => {
    const enq = (await db.query('SELECT * FROM enquiries WHERE id=$1 FOR UPDATE', [enquiry_id])).rows[0];
    if (!enq || enq.created_by !== req.user.id) throw new HttpError(404, 'Enquiry not found');
    if (['WON', 'LOST'].includes(enq.status)) throw new HttpError(409, `Enquiry is already ${enq.status}`);

    const seen = new Set(), prepared = [];
    for (const i of items) {
      const disc = Number(i.discount_pct ?? 0), gst = Number(i.gst_pct ?? 18);
      if (!posInt(i.product_id) || !posInt(i.quantity)) throw bad('Each item needs a product and a positive whole quantity');
      if (seen.has(i.product_id)) throw bad('A product can appear only once per quotation');
      if (!(disc >= 0 && disc <= 100) || !(gst >= 0 && gst <= 100)) throw bad('Discount and GST must be between 0 and 100');
      seen.add(i.product_id);
      const p = (await db.query('SELECT base_price FROM products WHERE id=$1', [i.product_id])).rows[0];
      if (!p) throw bad(`Product ${i.product_id} does not exist`);
      // Unit price defaults to the master price; any client-sent line/grand totals are ignored.
      const unit_price = i.unit_price === undefined ? Number(p.base_price) : Number(i.unit_price);
      if (!(unit_price >= 0)) throw bad('Unit price must be zero or more');
      prepared.push({ product_id: i.product_id, quantity: i.quantity, unit_price, discount_pct: disc, gst_pct: gst });
    }
    const { lines, grand_total } = totals(prepared);
    const q = await db.query(
      `INSERT INTO quotations (enquiry_id,customer_id,valid_until,grand_total,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [enq.id, enq.customer_id, valid_until, grand_total, req.user.id]);
    for (const l of lines)
      await db.query(
        `INSERT INTO quotation_items (quotation_id,product_id,quantity,unit_price,discount_pct,gst_pct,line_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [q.rows[0].id, l.product_id, l.quantity, l.unit_price, l.discount_pct, l.gst_pct, l.line_amount]);
    await db.query(`UPDATE enquiries SET status='QUOTED' WHERE id=$1`, [enq.id]);
    return q.rows[0].id;
  });
  res.status(201).json((await query(`${SELECT} WHERE q.id=$1`, [id])).rows[0]);
}));

const NEXT = { DRAFT: ['SENT'], SENT: ['ACCEPTED', 'REJECTED'] };
router.patch('/:id/status', authorize('SALES'), h(async (req, res) => {
  const to = req.body?.status;
  await tx(async (db) => {
    const q = (await db.query('SELECT * FROM quotations WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!q || q.created_by !== req.user.id) throw new HttpError(404, 'Quotation not found');
    if (!(NEXT[q.status] || []).includes(to)) throw new HttpError(409, `Cannot move quotation from ${q.status} to ${to}`);
    await db.query('UPDATE quotations SET status=$1 WHERE id=$2', [to, q.id]);
    if (to === 'ACCEPTED') await db.query(`UPDATE enquiries SET status='WON' WHERE id=$1`, [q.enquiry_id]);
    if (to === 'REJECTED') await db.query(`UPDATE enquiries SET status='LOST' WHERE id=$1`, [q.enquiry_id]);
  });
  res.json((await query(`${SELECT} WHERE q.id=$1`, [req.params.id])).rows[0]);
}));

router.post('/:id/convert', authorize('SALES'), h(async (req, res) => {
  const orderId = await tx(async (db) => {
    const q = (await db.query('SELECT * FROM quotations WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!q || q.created_by !== req.user.id) throw new HttpError(404, 'Quotation not found');
    if (q.status !== 'ACCEPTED') throw new HttpError(409, `Only ACCEPTED quotations can be converted (this one is ${q.status})`);
    if ((await db.query('SELECT 1 FROM sales_orders WHERE quotation_id=$1', [q.id])).rowCount)
      throw new HttpError(409, 'A Sales Order already exists for this quotation');
    // The row lock above plus UNIQUE(quotation_id) make double-conversion impossible.
    const so = await db.query(
      `INSERT INTO sales_orders (customer_id,quotation_id,total_amount,created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [q.customer_id, q.id, q.grand_total, req.user.id]);
    await db.query(
      `INSERT INTO sales_order_items (order_id,product_id,quantity,unit_price,line_amount)
       SELECT $1, product_id, quantity, unit_price, line_amount FROM quotation_items WHERE quotation_id=$2`,
      [so.rows[0].id, q.id]);
    return so.rows[0].id;
  });
  res.status(201).json({ id: orderId });
}));
module.exports = router;
