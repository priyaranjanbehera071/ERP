const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// base = qty x price; discount applied first, then GST on the discounted amount.
function lineAmount({ quantity, unit_price, discount_pct = 0, gst_pct = 0 }) {
  const base = quantity * unit_price;
  const afterDiscount = base * (1 - discount_pct / 100);
  return r2(afterDiscount * (1 + gst_pct / 100));
}
function totals(items) {
  const lines = items.map((i) => ({ ...i, line_amount: lineAmount(i) }));
  return { lines, grand_total: r2(lines.reduce((s, l) => s + l.line_amount, 0)) };
}
module.exports = { lineAmount, totals, r2 };
