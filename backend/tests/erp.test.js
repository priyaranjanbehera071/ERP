// Runs against TEST_DATABASE_URL (it is wiped on every run - never point it at real data).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const fs = require('fs'), path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db');
const seed = require('../db/seed');
const { lineAmount, totals } = require('../src/calc');

let admin, sales;
const api = (t) => ({
  get: (u) => request(app).get(u).set('Authorization', `Bearer ${t}`),
  post: (u, b) => request(app).post(u).set('Authorization', `Bearer ${t}`).send(b),
  patch: (u, b) => request(app).patch(u).set('Authorization', `Bearer ${t}`).send(b),
  put: (u, b) => request(app).put(u).set('Authorization', `Bearer ${t}`).send(b),
});
const login = async (email, password) => (await request(app).post('/api/auth/login').send({ email, password })).body.token;
const future = new Date(Date.now() + 864e5 * 30).toISOString().slice(0, 10);
const stock = async (pid) => (await api(admin).get('/api/inventory')).body.find((r) => r.product_id === pid);

// enquiry -> quotation (stops at the given status) for one product
async function makeQuotation(productId, qty, upTo = 'ACCEPTED') {
  const s = api(sales);
  const enq = (await s.post('/api/enquiries', {
    customer: { company_name: 'ABC Engineering Pvt. Ltd.', contact_person: 'Ravi', mobile: '9876543210', email: 'ravi@abc.com', city: 'Pune' },
    required_date: future, items: [{ product_id: productId, quantity: qty }],
  })).body;
  const quo = (await s.post('/api/quotations', { enquiry_id: enq.id, valid_until: future, items: [{ product_id: productId, quantity: qty, discount_pct: 0, gst_pct: 18 }] })).body;
  for (const st of ['SENT', 'ACCEPTED'].slice(0, upTo === 'DRAFT' ? 0 : upTo === 'SENT' ? 1 : 2))
    await s.patch(`/api/quotations/${quo.id}/status`, { status: st });
  return quo;
}
const makeOrder = async (pid, qty) => (await api(sales).post(`/api/quotations/${(await makeQuotation(pid, qty)).id}/convert`)).body.id;

beforeAll(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'));
  await seed();
  admin = await login('admin@erp.com', 'Admin@123');
  sales = await login('sales@erp.com', 'Sales@123');
});
afterAll(() => pool.end());

test('1. quotation total is calculated by the backend (client total ignored)', async () => {
  expect(lineAmount({ quantity: 10, unit_price: 100, discount_pct: 10, gst_pct: 18 })).toBe(1062); // 1000 -> 900 -> +18%
  expect(totals([{ quantity: 2, unit_price: 50, discount_pct: 0, gst_pct: 18 }]).grand_total).toBe(118);
  const enq = (await api(sales).post('/api/enquiries', {
    customer: { company_name: 'T Co', contact_person: 'T', mobile: '9999999999', email: 't@t.com', city: 'Pune' },
    required_date: future, items: [{ product_id: 1, quantity: 10 }] })).body;
  const q = await api(sales).post('/api/quotations', { enquiry_id: enq.id, valid_until: future, grand_total: 1,
    items: [{ product_id: 1, quantity: 10, unit_price: 100, discount_pct: 10, gst_pct: 18, line_amount: 1 }] });
  expect(q.status).toBe(201);
  expect(Number(q.body.grand_total)).toBe(1062);
});

test('2. DRAFT / REJECTED quotations cannot create a sales order', async () => {
  const draft = await makeQuotation(2, 5, 'DRAFT');
  expect((await api(sales).post(`/api/quotations/${draft.id}/convert`)).status).toBe(409);
  const rej = await makeQuotation(2, 5, 'SENT');
  await api(sales).patch(`/api/quotations/${rej.id}/status`, { status: 'REJECTED' });
  expect((await api(sales).post(`/api/quotations/${rej.id}/convert`)).status).toBe(409);
});

test('3. the same quotation cannot create duplicate sales orders (even concurrently)', async () => {
  const q = await makeQuotation(2, 5);
  const rs = await Promise.all([1, 2, 3].map(() => api(sales).post(`/api/quotations/${q.id}/convert`)));
  expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
  const { rows } = await pool.query('SELECT count(*) FROM sales_orders WHERE quotation_id=$1', [q.id]);
  expect(Number(rows[0].count)).toBe(1);
});

test('4. cannot reserve more than available inventory', async () => {
  await api(admin).put('/api/inventory/3', { physical_qty: 100 });
  const so = await makeOrder(3, 150);
  const r = await api(admin).post(`/api/sales-orders/${so}/confirm`);
  expect(r.status).toBe(409);
  expect((await stock(3)).reserved_qty).toBe(0);
  expect((await api(admin).put('/api/inventory/3', { physical_qty: -5 })).status).toBe(400);
});

test('5. unauthorised users are blocked from restricted operations', async () => {
  const so = await makeOrder(2, 5);
  expect((await request(app).get('/api/sales-orders')).status).toBe(401);
  expect((await api(sales).post(`/api/sales-orders/${so}/confirm`)).status).toBe(403);
  expect((await api(sales).put('/api/inventory/2', { physical_qty: 9999 })).status).toBe(403);
  expect((await api(admin).post('/api/enquiries', {})).status).toBe(403);
});

test('6. full flow: reserve keeps physical, dispatch lowers both, no double dispatch', async () => {
  await api(admin).put('/api/inventory/4', { physical_qty: 100 });
  const so = await makeOrder(4, 60);
  expect((await api(admin).post(`/api/sales-orders/${so}/confirm`)).status).toBe(200);
  expect(await stock(4)).toMatchObject({ physical_qty: 100, reserved_qty: 60, available_qty: 40 });
  const d = await api(admin).post(`/api/sales-orders/${so}/dispatch`, { vehicle_no: 'MH12AB1234', driver_name: 'Suresh' });
  expect(d.status).toBe(200);
  expect(await stock(4)).toMatchObject({ physical_qty: 40, reserved_qty: 0, available_qty: 40 });
  expect((await api(admin).post(`/api/sales-orders/${so}/dispatch`, { vehicle_no: 'X', driver_name: 'Y' })).status).toBe(409);
});

test('7. cancelling a confirmed order releases its reservation; cancelled order cannot dispatch', async () => {
  await api(admin).put('/api/inventory/5', { physical_qty: 100 });
  const so = await makeOrder(5, 30);
  await api(admin).post(`/api/sales-orders/${so}/confirm`);
  await api(admin).post(`/api/sales-orders/${so}/cancel`);
  expect((await stock(5)).reserved_qty).toBe(0);
  expect((await api(admin).post(`/api/sales-orders/${so}/dispatch`, { vehicle_no: 'A', driver_name: 'B' })).status).toBe(409);
});

test('BONUS. simultaneous reservations (80 vs 50 on 100 units): only one succeeds', async () => {
  await api(admin).put('/api/inventory/6', { physical_qty: 100 });
  const [a, b] = [await makeOrder(6, 80), await makeOrder(6, 50)];
  const rs = await Promise.all([a, b].map((id) => api(admin).post(`/api/sales-orders/${id}/confirm`)));
  expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
  const s = await stock(6);
  expect(s.reserved_qty).toBeLessThanOrEqual(100);
  expect(s.physical_qty).toBe(100);
});
