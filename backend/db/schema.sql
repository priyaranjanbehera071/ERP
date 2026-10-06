-- Re-runnable: drops and recreates everything (development only)
DROP TABLE IF EXISTS dispatch_items, dispatches, sales_order_items, sales_orders,
  quotation_items, quotations, enquiry_items, enquiries, inventory, products,
  customers, users CASCADE;
DROP SEQUENCE IF EXISTS enq_seq, quo_seq, so_seq, dsp_seq;
CREATE SEQUENCE enq_seq; CREATE SEQUENCE quo_seq; CREATE SEQUENCE so_seq; CREATE SEQUENCE dsp_seq;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','SALES')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_name, email)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_price NUMERIC(12,2) NOT NULL CHECK (base_price >= 0)
);

-- available = physical_qty - reserved_qty (computed in queries, never stored)
CREATE TABLE inventory (
  product_id INT PRIMARY KEY REFERENCES products(id),
  physical_qty INT NOT NULL DEFAULT 0 CHECK (physical_qty >= 0),
  reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reserved_within_physical CHECK (reserved_qty <= physical_qty)
);

CREATE TABLE enquiries (
  id SERIAL PRIMARY KEY,
  enquiry_no TEXT NOT NULL UNIQUE DEFAULT ('ENQ-' || lpad(nextval('enq_seq')::text, 6, '0')),
  customer_id INT NOT NULL REFERENCES customers(id),
  enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','QUOTED','WON','LOST')),
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE enquiry_items (
  id SERIAL PRIMARY KEY,
  enquiry_id INT NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  UNIQUE (enquiry_id, product_id)
);

CREATE TABLE quotations (
  id SERIAL PRIMARY KEY,
  quotation_no TEXT NOT NULL UNIQUE DEFAULT ('QUO-' || lpad(nextval('quo_seq')::text, 6, '0')),
  enquiry_id INT NOT NULL REFERENCES enquiries(id),
  customer_id INT NOT NULL REFERENCES customers(id),
  valid_until DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED')),
  grand_total NUMERIC(14,2) NOT NULL CHECK (grand_total >= 0),
  created_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  gst_pct NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (gst_pct BETWEEN 0 AND 100),
  line_amount NUMERIC(14,2) NOT NULL CHECK (line_amount >= 0),
  UNIQUE (quotation_id, product_id)
);

CREATE TABLE sales_orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE DEFAULT ('SO-' || lpad(nextval('so_seq')::text, 6, '0')),
  customer_id INT NOT NULL REFERENCES customers(id),
  quotation_id INT NOT NULL UNIQUE REFERENCES quotations(id),  -- UNIQUE: one quotation -> one order
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','DISPATCHED','CANCELLED')),
  created_by INT NOT NULL REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  line_amount NUMERIC(14,2) NOT NULL,
  reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0 AND reserved_qty <= quantity),
  UNIQUE (order_id, product_id)
);

CREATE TABLE dispatches (
  id SERIAL PRIMARY KEY,
  dispatch_no TEXT NOT NULL UNIQUE DEFAULT ('DSP-' || lpad(nextval('dsp_seq')::text, 6, '0')),
  order_id INT NOT NULL UNIQUE REFERENCES sales_orders(id),  -- UNIQUE: no duplicate dispatch
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  dispatched_by INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dispatch_items (
  id SERIAL PRIMARY KEY,
  dispatch_id INT NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX ON enquiries (created_by);
CREATE INDEX ON quotations (enquiry_id);
CREATE INDEX ON sales_orders (status);
