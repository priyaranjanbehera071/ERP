import { useEffect, useState, useCallback } from 'react';
import { api, setToken, money, date, lineCalc } from './api';

const Badge = ({ s }) => <span className={`badge b-${s}`}>{s}</span>;
const Modal = ({ title, onClose, children }) => (
  <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-label={title}><h2>{title}</h2>{children}</div>
  </div>
);
const P = { inbox:'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z', file:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5', box:'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', out:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', check:'M20 6L9 17l-5-5', clock:'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', rupee:'M6 4h12M6 9h12M9 4c6 0 6 8 0 8H6l8 8', truck:'M1 6h13v10H1zM14 9h4l3 3v4h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', plus:'M12 5v14M5 12h14', x:'M18 6L6 18M6 6l12 12', cart:'M3 3h2l2.5 11h11L21 7H6M9 20a1 1 0 1 0 .01 0M17 20a1 1 0 1 0 .01 0',shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1' };
const Icon = ({ n }) => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={P[n]} /></svg>;
const Stats = ({ items }) => (
  <div className="stats">{items.map(([label, value, icon, tone]) => (
    <div className={`stat ${tone || ''}`} key={label}><div className="chip"><Icon n={icon} /></div><div><span>{label}</span><strong>{value}</strong></div></div>))}</div>
);
const Empty = ({ icon, children }) => <div className="card empty"><Icon n={icon} /><div>{children}</div></div>;
const Field = ({ label, ...p }) => <label>{label}<input {...p} /></label>;

const TONES = { Fasteners: ['#fbe3b8', '#e8a23a'], Bearings: ['#d4e9f7', '#4f9ccb'], Hydraulics: ['#e0dcf7', '#7a68d4'], Valves: ['#d3f0e4', '#2f9e73'], 'Power Transmission': ['#f9d9d4', '#d9604c'], Lubricants: ['#fdf0c2', '#d9a400'], 'Raw Material': ['#e1e5e9', '#6b7a88'] };
function Art({ cat }) {
  const [bg, fg] = TONES[cat] || TONES['Raw Material'];
  const id = 'g' + String(cat).replace(/\W/g, '');
  const sk = { stroke: fg, strokeWidth: 6, fill: 'none', strokeLinecap: 'round' };
  const shapes = {
    Fasteners: <><polygon points="60,12 82,24 82,46 60,58 38,46 38,24" fill={fg} /><circle cx="60" cy="35" r="9" fill="#fff" /><rect x="54" y="58" width="12" height="16" fill={fg} /></>,
    Bearings: <><circle cx="60" cy="40" r="28" {...sk} /><circle cx="60" cy="40" r="16" {...sk} strokeWidth="4" /><circle cx="60" cy="40" r="6" fill={fg} /></>,
    Hydraulics: <><path d="M14 60 C40 8 62 74 106 20" {...sk} strokeWidth="9" /><circle cx="14" cy="60" r="7" fill={fg} /><circle cx="106" cy="20" r="7" fill={fg} /></>,
    Valves: <><rect x="12" y="46" width="96" height="14" rx="4" fill={fg} /><circle cx="60" cy="48" r="17" fill="#fff" stroke={fg} strokeWidth="5" /><path d="M60 31V16M44 16h32" {...sk} strokeWidth="5" /></>,
    'Power Transmission': <><rect x="24" y="22" width="72" height="36" rx="18" {...sk} strokeWidth="4" /><circle cx="42" cy="40" r="10" fill={fg} /><circle cx="78" cy="40" r="10" fill={fg} /></>,
    Lubricants: <><rect x="34" y="18" width="52" height="52" rx="6" fill={fg} /><ellipse cx="60" cy="18" rx="26" ry="6" fill="#fff" opacity=".6" /><path d="M34 33h52M34 54h52" stroke="#fff" strokeWidth="3" opacity=".7" /></>,
    'Raw Material': <><rect x="16" y="16" width="88" height="12" rx="3" fill={fg} /><rect x="16" y="34" width="88" height="12" rx="3" fill={fg} opacity=".8" /><rect x="16" y="52" width="88" height="12" rx="3" fill={fg} opacity=".6" /></>,
  };
  return (
    <svg className="art" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={bg} /></linearGradient></defs>
      <rect width="120" height="80" fill={`url(#${id})`} />{shapes[cat] || shapes['Raw Material']}
    </svg>
  );
}

function StockGrid({ rows, products, addToCart }) {
  const [qty, setQty] = useState({});
  const info = Object.fromEntries((products || []).map((x) => [x.id, x]));
  return (
    <>
      <h2 className="sect">Stock levels</h2>
      <div className="pgrid">
        {rows?.map((p) => {
          const pr = info[p.product_id] || {};
          const n = qty[p.product_id] || 1;
          const set = (v) => setQty({ ...qty, [p.product_id]: Math.max(1, Number(v) || 1) });
          const pct = (x) => `${p.physical_qty ? (x / p.physical_qty) * 100 : 0}%`;
          const st = p.available_qty <= 0 ? ['out', 'Out of stock'] : p.available_qty < 20 ? ['low', 'Low stock'] : ['ok', 'In stock'];
          return (
            <div className="card pcard" key={p.product_id}>
              <div className="art-wrap"><Art cat={pr.category} /><span className={`stk ${st[0]}`}>{st[1]}</span></div>
              <div className="pbody">
                <div className="pcat">{pr.category}</div>
                <b>{p.name}</b>
                <div className="meta">{p.code} · {money(pr.base_price)} per {p.unit}</div>
                <div className="bar" title="Reserved and available share of present stock"><i className="r" style={{ width: pct(p.reserved_qty) }} /><i className="a" style={{ width: pct(p.available_qty) }} /></div>
                <div className="qrow">
                  <div><strong>{p.physical_qty}</strong><span>Present</span></div>
                  <div><strong className="am">{p.reserved_qty}</strong><span>Reserved</span></div>
                  <div><strong className="gr">{p.available_qty}</strong><span>Available</span></div>
                </div>
                {addToCart && (
                  <div className="cartrow">
                    <div className="step">
                      <button type="button" aria-label="Decrease" onClick={() => set(n - 1)}>−</button>
                      <input type="number" min="1" value={n} onChange={(e) => set(e.target.value)} aria-label="Quantity" />
                      <button type="button" aria-label="Increase" onClick={() => set(n + 1)}>+</button>
                    </div>
                    <button className="btn pri sm" onClick={() => addToCart(p.product_id, n)}><Icon n="cart" />Add to cart</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function useList(path) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api(path).then(setRows).catch((e) => setError(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return { rows, error, load };
}

/* ---------------- Auth ---------------- */
function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api(`/auth/${mode}`, { method: 'POST', body: f });
      setToken(r.token); onAuth(r.user);
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth">
      <section className="auth-art">
        <div className="logo"><i>F</i>Foundry ERP</div>
        <div>
          <h1>From enquiry to dispatch, one trail.</h1>
          <p>Run your industrial sales workflow in one place, with every order traceable back to the customer's first enquiry.</p>
          <div className="feats">
            <div className="feat"><Icon n="shield" /><div><b>Role-based access</b>Admins control stock and dispatch; sales teams handle customers.</div></div>
            <div className="feat"><Icon n="box" /><div><b>Safe stock reservation</b>Two people can never reserve the same units twice.</div></div>
            <div className="feat"><Icon n="link" /><div><b>Full traceability</b>Enquiry, quotation, order and dispatch stay linked.</div></div>
          </div>
        </div>
        <div className="flow"><b>Enquiry</b>›<b>Quotation</b>›<b>Sales order</b>›<b>Reservation</b>›<b>Dispatch</b></div>
      </section>
      <section className="auth-form">
        <form onSubmit={submit}>
          <div className="tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Sign in</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Create account</button>
          </div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Join as a sales user'}</h2>
          <p className="sub">{mode === 'login' ? 'Sign in to manage enquiries, quotes and orders.' : 'Register with your email to start creating enquiries.'}</p>
          {mode === 'register' && <Field label="Full name" value={f.name} onChange={set('name')} required />}
          <Field label="Email" type="email" value={f.email} onChange={set('email')} required />
          <Field label="Password" type="password" minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={set('password')} required />
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn pri">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
          {mode === 'login' && <div className="demo">Try a demo account:<br />
            <button type="button" onClick={() => setF({ ...f, email: 'sales@erp.com', password: 'Sales@123' })}>Sales user</button> · <button type="button" onClick={() => setF({ ...f, email: 'admin@erp.com', password: 'Admin@123' })}>Administrator</button></div>}
        </form>
      </section>
    </div>
  );
}

/* ---------------- Enquiries ---------------- */
function EnquiryForm({ products, onDone, onClose, initialItems }) {
  const [c, setC] = useState({ company_name: '', contact_person: '', mobile: '', email: '', city: '' });
  const [req, setReq] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState(initialItems?.length ? initialItems : [{ product_id: '', quantity: 1 }]);
  const [err, setErr] = useState('');
  const upd = (i, k, v) => setItems(items.map((r, x) => (x === i ? { ...r, [k]: v } : r)));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api('/enquiries', { method: 'POST', body: {
        customer: c, required_date: req, notes,
        items: items.map((i) => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })) } });
      onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="New enquiry" onClose={onClose}>
      <form style={{ display: 'grid', gap: 14 }} onSubmit={submit}>
        <div className="grid2">
          {[['company_name', 'Company name'], ['contact_person', 'Contact person'], ['mobile', 'Mobile'], ['email', 'Email'], ['city', 'City']].map(([k, l]) =>
            <Field key={k} label={l} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} required />)}
          <Field label="Required date" type="date" value={req} onChange={(e) => setReq(e.target.value)} required />
        </div>
        {items.map((it, i) => (
          <div className="irow e" key={i}>
            <label>Product
              <select value={it.product_id} onChange={(e) => upd(i, 'product_id', e.target.value)} required>
                <option value="">Select a product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </select>
            </label>
            <Field label="Quantity" type="number" min="1" step="1" value={it.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} required />
            <button type="button" className="btn sm" disabled={items.length < 2} onClick={() => setItems(items.filter((_, x) => x !== i))}>Remove</button>
          </div>
        ))}
        <div><button type="button" className="btn sm" onClick={() => setItems([...items, { product_id: '', quantity: 1 }])}>Add product</button></div>
        <label>Notes<textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri">Save enquiry</button>
        </div>
      </form>
    </Modal>
  );
}

function Enquiries({ user, products }) {
  const { rows, error, load } = useList('/enquiries');
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="head"><div><h1>Enquiries</h1><p>Customer requests waiting for a quotation.</p></div>
        {user.role === 'SALES' && <button className="btn pri" onClick={() => setOpen(true)}><Icon n="plus" />New enquiry</button>}</div>
      {rows && <Stats items={[['Total enquiries', rows.length, 'inbox'], ['New', rows.filter((r) => r.status === 'NEW').length, 'clock', 'amber'], ['Quoted', rows.filter((r) => r.status === 'QUOTED').length, 'file'], ['Won', rows.filter((r) => r.status === 'WON').length, 'check', 'green']]} />}
      {error && <div className="err">{error}</div>}
      {rows?.length === 0 && <Empty icon="inbox">No enquiries yet.{user.role === 'SALES' ? ' Click “New enquiry” to add your first customer request.' : ''}</Empty>}
      {rows?.map((e) => (
        <div className="card rec" key={e.id}>
          <div className="rec-top">
            <div><h3>{e.company_name}</h3><div className="meta">{e.enquiry_no} · {e.contact_person} · {e.mobile} · {e.city}</div></div>
            <Badge s={e.status} />
          </div>
          <div className="meta">Enquired {date(e.enquiry_date)} · needed by {date(e.required_date)}{e.notes ? ` · ${e.notes}` : ''}</div>
          <table><thead><tr><th>Product</th><th className="n">Quantity</th></tr></thead>
            <tbody>{e.items.map((i) => <tr key={i.product_id}><td>{i.code} · {i.name}</td><td className="n">{i.quantity} {i.unit}</td></tr>)}</tbody></table>
        </div>
      ))}
      {open && <EnquiryForm products={products} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </>
  );
}

/* ---------------- Quotations ---------------- */
function QuotationForm({ enquiries, onDone, onClose }) {
  const open = enquiries.filter((e) => ['NEW', 'QUOTED'].includes(e.status));
  const [eid, setEid] = useState('');
  const [valid, setValid] = useState('');
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const pick = (id) => {
    setEid(id);
    const e = open.find((x) => String(x.id) === id);
    setItems(e ? e.items.map((i) => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: Number(i.base_price), discount_pct: 0, gst_pct: 18 })) : []);
  };
  const upd = (i, k, v) => setItems(items.map((r, x) => (x === i ? { ...r, [k]: Number(v) } : r)));
  const preview = items.reduce((s, i) => s + lineCalc(i), 0);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api('/quotations', { method: 'POST', body: { enquiry_id: Number(eid), valid_until: valid,
        items: items.map(({ name, ...i }) => i) } });
      onDone();
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="New quotation" onClose={onClose}>
      <form style={{ display: 'grid', gap: 14 }} onSubmit={submit}>
        <div className="grid2">
          <label>Enquiry
            <select value={eid} onChange={(e) => pick(e.target.value)} required>
              <option value="">Select an enquiry</option>
              {open.map((e) => <option key={e.id} value={e.id}>{e.enquiry_no} · {e.company_name}</option>)}
            </select>
          </label>
          <Field label="Valid until" type="date" value={valid} onChange={(e) => setValid(e.target.value)} required />
        </div>
        {items.map((it, i) => (
          <div className="irow" key={it.product_id}>
            <label>Product<input value={it.name} disabled /></label>
            <Field label="Quantity" type="number" min="1" value={it.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} />
            <Field label="Unit price" type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => upd(i, 'unit_price', e.target.value)} />
            <Field label="Discount %" type="number" min="0" max="100" value={it.discount_pct} onChange={(e) => upd(i, 'discount_pct', e.target.value)} />
            <Field label="GST %" type="number" min="0" max="100" value={it.gst_pct} onChange={(e) => upd(i, 'gst_pct', e.target.value)} />
          </div>
        ))}
        {items.length > 0 && <div className="total">Estimated total {money(preview)}<div className="meta">The server recalculates the final amount when you save.</div></div>}
        {err && <div className="err" role="alert">{err}</div>}
        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={!items.length}>Save quotation</button>
        </div>
      </form>
    </Modal>
  );
}

function Quotations({ user }) {
  const { rows, error, load } = useList('/quotations');
  const enq = useList('/enquiries');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const act = async (fn, ok) => {
    try { await fn(); setMsg({ ok, err: '' }); load(); enq.load(); } catch (e) { setMsg({ ok: '', err: e.message }); }
  };
  const status = (id, s) => act(() => api(`/quotations/${id}/status`, { method: 'PATCH', body: { status: s } }), `Quotation marked ${s}`);
  const convert = (id) => act(() => api(`/quotations/${id}/convert`, { method: 'POST' }), 'Sales order created. Find it under Sales orders.');
  const sales = user.role === 'SALES';
  return (
    <>
      <div className="head"><div><h1>Quotations</h1><p>Price an enquiry, send it, then record the customer's decision.</p></div>
        {sales && <button className="btn pri" onClick={() => setOpen(true)}><Icon n="plus" />New quotation</button>}</div>
      {rows && <Stats items={[['Quotations', rows.length, 'file'], ['Awaiting reply', rows.filter((r) => r.status === 'SENT').length, 'clock', 'amber'], ['Accepted', rows.filter((r) => r.status === 'ACCEPTED').length, 'check', 'green'], ['Accepted value', money(rows.filter((r) => r.status === 'ACCEPTED').reduce((a, r) => a + Number(r.grand_total), 0)), 'rupee']]} />}
      {msg.ok && <div className="ok">{msg.ok}</div>}
      {(msg.err || error) && <div className="err" role="alert" style={{ marginBottom: 14 }}>{msg.err || error}</div>}
      {rows?.length === 0 && <Empty icon="file">No quotations yet. Create one from an enquiry.</Empty>}
      {rows?.map((q) => (
        <div className="card rec" key={q.id}>
          <div className="rec-top">
            <div><h3>{q.quotation_no} · {q.company_name}</h3><div className="meta">Valid until {date(q.valid_until)}</div></div>
            <div style={{ textAlign: 'right' }}><Badge s={q.status} /><div style={{ fontWeight: 600, marginTop: 6 }}>{money(q.grand_total)}</div></div>
          </div>
          <div className="chain"><span>{q.enquiry_no}</span>›<span>{q.quotation_no}</span>{q.order_no && <>›<span>{q.order_no}</span></>}</div>
          <table><thead><tr><th>Product</th><th className="n">Qty</th><th className="n">Price</th><th className="n">Disc.</th><th className="n">GST</th><th className="n">Line total</th></tr></thead>
            <tbody>{q.items.map((i) => <tr key={i.product_id}><td>{i.name}</td><td className="n">{i.quantity}</td><td className="n">{money(i.unit_price)}</td><td className="n">{Number(i.discount_pct)}%</td><td className="n">{Number(i.gst_pct)}%</td><td className="n">{money(i.line_amount)}</td></tr>)}</tbody></table>
          {sales && (
            <div className="actions">
              {q.status === 'DRAFT' && <button className="btn pri sm" onClick={() => status(q.id, 'SENT')}>Mark as sent</button>}
              {q.status === 'SENT' && <>
                <button className="btn pri sm" onClick={() => status(q.id, 'ACCEPTED')}>Accept</button>
                <button className="btn dng sm" onClick={() => status(q.id, 'REJECTED')}>Reject</button></>}
              {q.status === 'ACCEPTED' && !q.order_no && <button className="btn pri sm" onClick={() => convert(q.id)}>Convert to sales order</button>}
            </div>
          )}
        </div>
      ))}
      {open && enq.rows && <QuotationForm enquiries={enq.rows} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); enq.load(); }} />}
    </>
  );
}

/* ---------------- Sales orders + inventory ---------------- */
function Orders({ user, products, addToCart }) {
  const { rows, error, load } = useList('/sales-orders');
  const inv = useList('/inventory');
  const [msg, setMsg] = useState({ ok: '', err: '' });
  const [disp, setDisp] = useState(null);
  const [dv, setDv] = useState({ vehicle_no: '', driver_name: '' });
  const admin = user.role === 'ADMIN';
  const act = async (path, ok, body) => {
    try { await api(path, { method: 'POST', body }); setMsg({ ok, err: '' }); setDisp(null); load(); inv.load(); }
    catch (e) { setMsg({ ok: '', err: e.message }); }
  };
  return (
    <>
      <div className="head"><div><h1>Sales orders</h1><p>Confirming an order reserves stock. Dispatching ships it and reduces physical stock.</p></div></div>
      {rows && <Stats items={[['Pending', rows.filter((r) => r.status === 'PENDING').length, 'clock', 'amber'], ['Confirmed', rows.filter((r) => r.status === 'CONFIRMED').length, 'box'], ['Dispatched', rows.filter((r) => r.status === 'DISPATCHED').length, 'truck', 'green'], ['Dispatched value', money(rows.filter((r) => r.status === 'DISPATCHED').reduce((a, r) => a + Number(r.total_amount), 0)), 'rupee']]} />}
      <StockGrid rows={inv.rows} products={products} addToCart={addToCart} />
      {msg.ok && <div className="ok">{msg.ok}</div>}
      {(msg.err || error) && <div className="err" role="alert" style={{ marginBottom: 14 }}>{msg.err || error}</div>}
      {rows?.length === 0 && <Empty icon="box">No sales orders yet. Accepted quotations can be converted into orders.</Empty>}
      {rows?.map((o) => (
        <div className="card rec" key={o.id}>
          <div className="rec-top">
            <div><h3>{o.order_no} · {o.company_name}</h3><div className="meta">Ordered {date(o.order_date)}</div></div>
            <div style={{ textAlign: 'right' }}><Badge s={o.status} /><div style={{ fontWeight: 600, marginTop: 6 }}>{money(o.total_amount)}</div></div>
          </div>
          <div className="chain"><span>{o.enquiry_no}</span>›<span>{o.quotation_no}</span>›<span>{o.order_no}</span>{o.dispatch_no && <>›<span>{o.dispatch_no}</span></>}</div>
          <table><thead><tr><th>Product</th><th className="n">Ordered</th><th className="n">Reserved</th><th className="n">Free stock</th></tr></thead>
            <tbody>{o.items.map((i) => (
              <tr key={i.product_id}><td>{i.name}</td><td className="n">{i.quantity}</td><td className="n">{i.reserved_qty}</td>
                <td className={`n ${o.status === 'PENDING' && i.available_qty < i.quantity ? 'low' : ''}`}>{i.available_qty}</td></tr>))}</tbody></table>
          {o.dispatch_no && <div className="meta" style={{ marginTop: 10 }}>Dispatched {date(o.dispatch_date)} · vehicle {o.vehicle_no} · driver {o.driver_name}</div>}
          {admin && (
            <div className="actions">
              {o.status === 'PENDING' && <button className="btn pri sm" onClick={() => act(`/sales-orders/${o.id}/confirm`, `${o.order_no} confirmed and stock reserved`)}>Confirm and reserve stock</button>}
              {o.status === 'CONFIRMED' && <button className="btn pri sm" onClick={() => setDisp(o)}>Dispatch</button>}
              {['PENDING', 'CONFIRMED'].includes(o.status) && <button className="btn dng sm" onClick={() => act(`/sales-orders/${o.id}/cancel`, `${o.order_no} cancelled`)}>Cancel order</button>}
            </div>
          )}
        </div>
      ))}
      {disp && (
        <Modal title={`Dispatch ${disp.order_no}`} onClose={() => setDisp(null)}>
          <form style={{ display: 'grid', gap: 14 }} onSubmit={(e) => { e.preventDefault(); act(`/sales-orders/${disp.id}/dispatch`, `${disp.order_no} dispatched`, dv); }}>
            <div className="grid2">
              <Field label="Vehicle number" value={dv.vehicle_no} onChange={(e) => setDv({ ...dv, vehicle_no: e.target.value })} required />
              <Field label="Driver name" value={dv.driver_name} onChange={(e) => setDv({ ...dv, driver_name: e.target.value })} required />
            </div>
            <div className="meta">All reserved quantities ({disp.items.map((i) => `${i.name}: ${i.reserved_qty}`).join(', ')}) will leave the warehouse.</div>
            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setDisp(null)}>Cancel</button>
              <button className="btn pri">Dispatch order</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function CartModal({ cart, setCart, products, onClose, onCheckout }) {
  const info = Object.fromEntries(products.map((x) => [x.id, x]));
  const ids = Object.keys(cart);
  const total = ids.reduce((a, id) => a + cart[id] * Number(info[id]?.base_price || 0), 0);
  const set = (id, v) => setCart({ ...cart, [id]: Math.max(1, Number(v) || 1) });
  const del = (id) => { const c = { ...cart }; delete c[id]; setCart(c); };
  return (
    <Modal title="Your cart" onClose={onClose}>
      {!ids.length ? <div className="empty">Your cart is empty. Add products from the stock list.</div> : (
        <>
          {ids.map((id) => (
            <div className="crow" key={id}>
              <div><b>{info[id]?.name}</b><div className="meta">{info[id]?.code} · {money(info[id]?.base_price)} per {info[id]?.unit}</div></div>
              <div className="step">
                <button type="button" aria-label="Decrease" onClick={() => set(id, cart[id] - 1)}>−</button>
                <input type="number" min="1" value={cart[id]} onChange={(e) => set(id, e.target.value)} aria-label="Quantity" />
                <button type="button" aria-label="Increase" onClick={() => set(id, cart[id] + 1)}>+</button>
              </div>
              <button className="btn sm dng" onClick={() => del(id)}>Remove</button>
            </div>
          ))}
          <div className="total">Estimated value {money(total)}<div className="meta">List prices before discount and GST. The quotation sets the final price.</div></div>
        </>
      )}
      <div className="actions" style={{ justifyContent: 'flex-end', borderTop: 0, marginTop: 0 }}>
        <button className="btn" onClick={onClose}>Keep browsing</button>
        {ids.length > 0 && <button className="btn" onClick={() => setCart({})}>Clear cart</button>}
        <button className="btn pri" disabled={!ids.length} onClick={onCheckout}>Request quote for these items</button>
      </div>
    </Modal>
  );
}

/* ---------------- Shell ---------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('enquiries');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [showEnq, setShowEnq] = useState(false);
  const [toast, setToast] = useState('');
  const [ek, setEk] = useState(0);

  useEffect(() => {
    api('/auth/me').then((u) => setUser({ ...u })).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (user) api('/products').then(setProducts).catch(() => {}); }, [user]);

  if (!ready) return null;
  if (!user) return <Auth onAuth={setUser} />;
  const logout = () => { setToken(null); setUser(null); setCart({}); };
  const addToCart = (id, n) => {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + n }));
    setToast('Added to cart'); setTimeout(() => setToast(''), 1800);
  };
  const cartCount = Object.keys(cart).length;
  const tabs = [['enquiries', 'Enquiries', 'inbox'], ['quotations', 'Quotations', 'file'], ['orders', 'Sales orders', 'box']];
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo"><i>F</i>Foundry ERP</div>
        {tabs.map(([k, l, ic]) => <button key={k} className={`nav ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}><Icon n={ic} />{l}</button>)}
        {user.role === 'SALES' && <button className="nav cartbtn" onClick={() => setShowCart(true)}><Icon n="cart" />Cart{cartCount > 0 && <em>{cartCount}</em>}</button>}
        <div className="who"><div className="av">{(user.name || '?')[0].toUpperCase()}</div>
          <div>{user.name}<small>{user.role === 'ADMIN' ? 'Administrator' : 'Sales user'}</small></div>
          <button className="out" onClick={logout} title="Sign out" aria-label="Sign out"><Icon n="out" /></button></div>
      </aside>
      <main className="main">
        {tab === 'enquiries' && <Enquiries key={ek} user={user} products={products} />}
        {tab === 'quotations' && <Quotations user={user} />}
        {tab === 'orders' && <Orders user={user} products={products} addToCart={user.role === 'SALES' ? addToCart : null} />}
        {toast && <div className="toast" role="status">{toast}</div>}
        {showCart && <CartModal cart={cart} setCart={setCart} products={products} onClose={() => setShowCart(false)} onCheckout={() => { setShowCart(false); setShowEnq(true); }} />}
        {showEnq && <EnquiryForm products={products} onClose={() => setShowEnq(false)}
          initialItems={Object.entries(cart).map(([id, q]) => ({ product_id: id, quantity: q }))}
          onDone={() => { setShowEnq(false); setCart({}); setTab('enquiries'); setEk((k) => k + 1); }} />}
      </main>
    </div>
  );
}