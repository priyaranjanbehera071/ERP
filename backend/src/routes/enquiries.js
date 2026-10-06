const router = require('express').Router();
const { query, tx } = require('../db');
const { h, bad, posInt } = require('../util');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

const SELECT = `
  SELECT e.*, c.company_name, c.contact_person, c.mobile, c.email, c.city,
   (SELECT json_agg(json_build_object('product_id', i.product_id, 'code', p.code,
      'name', p.name, 'unit', p.unit, 'base_price', p.base_price, 'quantity', i.quantity) ORDER BY i.id)
    FROM enquiry_items i JOIN products p ON p.id = i.product_id WHERE i.enquiry_id = e.id) AS items
  FROM enquiries e JOIN customers c ON c.id = e.customer_id`;

router.get('/', h(async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const { rows } = await query(`${SELECT} WHERE ($1::boolean OR e.created_by = $2) ORDER BY e.id DESC`, [admin, req.user.id]);
  res.json(rows);
}));

router.post('/', authorize('SALES'), h(async (req, res) => {
  const { customer: c = {}, required_date, notes, items } = req.body || {};
  for (const f of ['company_name', 'contact_person', 'mobile', 'email', 'city'])
    if (!String(c[f] || '').trim()) throw bad(`Customer ${f.replace('_', ' ')} is required`);
  if (!/^\S+@\S+\.\S+$/.test(c.email)) throw bad('Customer email is invalid');
  if (!/^[0-9+\-\s]{7,15}$/.test(c.mobile)) throw bad('Customer mobile is invalid');
  if (!required_date || isNaN(Date.parse(required_date))) throw bad('Required date is invalid');
  if (!Array.isArray(items) || !items.length) throw bad('Add at least one product');
  const ids = new Set();
  for (const i of items) {
    if (!posInt(i.product_id) || !posInt(i.quantity)) throw bad('Each item needs a product and a positive whole quantity');
    if (ids.has(i.product_id)) throw bad('A product can appear only once per enquiry');
    ids.add(i.product_id);
  }
  const created = await tx(async (db) => {
    const cust = await db.query(
      `INSERT INTO customers (company_name,contact_person,mobile,email,city,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_name,email) DO UPDATE SET contact_person=EXCLUDED.contact_person,
         mobile=EXCLUDED.mobile, city=EXCLUDED.city RETURNING id`,
      [c.company_name.trim(), c.contact_person.trim(), c.mobile.trim(), c.email.toLowerCase(), c.city.trim(), req.user.id]);
    const enq = await db.query(
      `INSERT INTO enquiries (customer_id,required_date,notes,created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [cust.rows[0].id, required_date, notes || null, req.user.id]);
    for (const i of items)
      await db.query('INSERT INTO enquiry_items (enquiry_id,product_id,quantity) VALUES ($1,$2,$3)', [enq.rows[0].id, i.product_id, i.quantity]);
    return enq.rows[0].id;
  });
  const { rows } = await query(`${SELECT} WHERE e.id=$1`, [created]);
  res.status(201).json(rows[0]);
}));
module.exports = router;
