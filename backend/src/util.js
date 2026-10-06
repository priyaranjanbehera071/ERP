class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const posInt = (v) => Number.isInteger(v) && v > 0;
const bad = (msg) => new HttpError(400, msg);
module.exports = { HttpError, h, posInt, bad };
