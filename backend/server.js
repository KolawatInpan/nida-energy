// backend/server.js
const express = require('express');
const cors = require('cors');
// const transactionRoutes = require('./routes/transaction.routes');
const userRoutes = require('./routes/user.routes');
// const walletRoutes = require('./routes/wallet.routes');
// const rateRoutes = require('./routes/dashboard.routes');
const buildingRoutes = require("./routes/building.routes");
const meterRoutes = require("./routes/meter.routes");
// const devRoutes = require('./routes/devRoutes');
// const batteryRoutes = require('./routes/battery.routes');
// const energyRoutes = require('./routes/energy.routes');
// const runningMeterRoutes = require('./routes/runningMeter.routes');
// const rateApiRoutes = require('./routes/rateRoutes');
// const systemRoutes = require('./routes/system.routes');
// const invoiceRoutes = require('./routes/invoice.routes');
// const receiptRoutes = require('./routes/receipt.routes');

const app = express();
// CORS: allow the frontend origin and support credentials (cookies or auth flows)
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
// parse JSON bodies
app.use(express.json());
// also accept urlencoded form bodies (e.g. Postman form-data / x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/wallet', walletRoutes);

// Convenience alias: list all wallets
// app.get('/wallets', (req, res, next) => {
// 	// forward to wallet routes handler
// 	req.url = '/';
// 	return walletRoutes.handle(req, res, next);
// });
// app.use('/api/dashboard', rateRoutes);
app.use("/api/buildings", buildingRoutes);
app.use('/api/meters', meterRoutes);
// app.use('/api/energy', energyRoutes);
// app.use('/api/energy/running', runningMeterRoutes);
// app.use('/api/rates', rateApiRoutes);
// app.use('/api/system', systemRoutes);
// app.use('/api/dev', devRoutes);
// app.use('/api/batteries', batteryRoutes);
// app.use('/api/invoices', invoiceRoutes);
// app.use('/api/receipts', receiptRoutes);

// health endpoint for quick checks
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok' });
});

const PORT = 3001;
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
