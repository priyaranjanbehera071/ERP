const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const products = [
  ['PRD-001', 'Hex Bolt M12 x 60 (Grade 8.8)', 'Fasteners', 'Box', 850, 500],
  ['PRD-002', 'Ball Bearing 6205-2RS', 'Bearings', 'Pcs', 320, 400],
  ['PRD-003', 'Hydraulic Hose 1/2" x 3m', 'Hydraulics', 'Pcs', 1450, 150],
  ['PRD-004', 'Gate Valve 2" Cast Iron', 'Valves', 'Pcs', 2800, 80],
  ['PRD-005', 'V-Belt B-Section 1800mm', 'Power Transmission', 'Pcs', 540, 250],
  ['PRD-006', 'Industrial Lubricant 20L (ISO VG 68)', 'Lubricants', 'Drum', 6200, 60],
  ['PRD-007', 'MS Flat Bar 50x6mm (6m)', 'Raw Material', 'Pcs', 1900, 120],
];

async function seed() {
  await pool.query('TRUNCATE inventory, products, users RESTART IDENTITY CASCADE');
  const hash = (p) => bcrypt.hash(p, 10);
  await pool.query(
    `INSERT INTO users (name,email,password_hash,role) VALUES
     ('Admin User','admin@erp.com',$1,'ADMIN'),('Sales User','sales@erp.com',$2,'SALES')`,
    [await hash('Admin@123'), await hash('Sales@123')]);
  for (const [code, name, cat, unit, price, qty] of products) {
    const { rows } = await pool.query(
      'INSERT INTO products (code,name,category,unit,base_price) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [code, name, cat, unit, price]);
    await pool.query('INSERT INTO inventory (product_id,physical_qty,reserved_qty) VALUES ($1,$2,0)', [rows[0].id, qty]);
  }
}
module.exports = seed;
if (require.main === module)
  seed().then(() => { console.log('Seeded.'); return pool.end(); }).catch(e => { console.error(e); process.exit(1); });
