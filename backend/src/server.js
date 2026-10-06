const app = require('./app');
const port = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set (copy .env.example to .env)');
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
