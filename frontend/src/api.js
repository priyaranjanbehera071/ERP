let token = localStorage.getItem('token');
export const setToken = (t) => { token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); };

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const extra = data.details?.length ? ` (${data.details.map((d) => `need ${d.required}, have ${d.available}`).join('; ')})` : '';
    const err = new Error((data.error || 'Request failed') + extra);
    err.status = res.status; throw err;
  }
  return data;
}
export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
// Preview only: the backend recalculates and is the source of truth.
export const lineCalc = (i) => Math.round(i.quantity * i.unit_price * (1 - i.discount_pct / 100) * (1 + i.gst_pct / 100) * 100) / 100;
