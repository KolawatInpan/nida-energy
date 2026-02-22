// backend/server.js
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');
const buildingRoutes = require("./routes/building.routes");
const meterRoutes = require("./routes/meter.routes");
const walletRoutes = require('./routes/wallet.routes');

const app = express();
// CORS: allow the frontend origin and support credentials (cookies or auth flows)
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
// parse JSON bodies
app.use(express.json());
// also accept urlencoded form bodies (e.g. Postman form-data / x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

app.use('/api/users', userRoutes);
app.use("/api/buildings", buildingRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/wallets', walletRoutes);


// health endpoint for quick checks
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

const PORT = 8000;
// run DB initialization for local/dev environments to handle schema drift
try {
	// log DATABASE_URL for debugging connection target
	try { console.log('DATABASE_URL=', process.env.DATABASE_URL); } catch(_) {}
	const { ensureCredIdColumn } = require('./utils/dbInit');
	ensureCredIdColumn().catch(e => console.warn('ensureCredIdColumn error', e && e.message ? e.message : e));
} catch (e) {
	console.warn('DB init module not available', e && e.message ? e.message : e);
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// JSON error handler (dev-friendly)
app.use((err, req, res, next) => {
	console.error('Unhandled error', err);
	res.status(500).json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
});
