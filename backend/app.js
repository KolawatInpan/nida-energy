const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const asyncHandler = require('./middleware/asyncHandler');
const dataModeMiddleware = require('./middleware/dataMode');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const features = require('./features');

const { routes: userRoutes } = features.users;
const { routes: buildingRoutes } = features.building;
const { routes: meterRoutes } = features.meters;
const { routes: walletRoutes } = features.wallets;
const { routes: offerRoutes } = features.trading;
const marketRoutes = require('./features/trading/market.routes');
const { runningMeterRoutes, energyRoutes } = features.energy;
const { invoiceRoutes, receiptRoutes } = features.billing;
const { routes: transactionRoutes } = features.transactions;
const { routes: dashboardRoutes } = features.dashboard;
const { routes: rateRoutes } = features.rates;
const { routes: systemRoutes } = features.system;
const paymentRoutes = require('./features/payments/payment.routes');
const demoRoutes = require('./features/demo/demo.routes');

const notificationRoutes = require('./features/notification/notification.route');

function createApp() {
  const app = express();

  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'NIDA API',
        version: '1.0.0',
        description: 'API documentation for NIDA project',
      },
      servers: [
        { url: 'http://localhost:8000/api', description: 'Local development server' },
      ],
    },
    apis: ['./features/**/*.routes.js'],
  };

  const swaggerSpec = swaggerJSDoc(swaggerOptions);
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Read frontend origin from environment (e.g., .env.dev) and enforce it for CORS.
  const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(dataModeMiddleware);

  app.use('/api/users', userRoutes);
  app.use('/api/buildings', buildingRoutes);
  app.use('/api/meters', meterRoutes);
  app.use('/api/wallets', walletRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/runningMeters', runningMeterRoutes);
  app.use('/api/energy', energyRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/receipts', receiptRoutes);
  // Manual trigger: check & auto-post battery surplus for a building
  app.post('/api/buildings/:id/trigger-battery', asyncHandler(async (req, res) => {
    const { prisma } = require('./utils/prisma');
    const buildingId = parseInt(req.params.id, 10);
    const building = await prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) return res.status(404).json({ error: 'Building not found' });
    const { autoPostBatterySurplusOffer } = require('./features/trading/trade.engine');
    const result = await autoPostBatterySurplusOffer(building.name);
    res.json(result);
  }));
  // Direct transactions endpoint (bypasses module hang)
  app.get('/api/transactions', asyncHandler(async (req, res) => {
    const { prisma } = require('./utils/prisma');
    const rows = await prisma.transaction.findMany({ orderBy: { timestamp: 'desc' } });

    // Enrich: resolve buildingName from walletId when missing
    const enriched = await Promise.all(rows.map(async (tx) => {
      if (tx.buildingName) return tx;
      if (!tx.walletId) return tx;
      try {
        const wallet = await prisma.wallet.findUnique({ where: { id: String(tx.walletId) }, select: { email: true } });
        if (wallet?.email) {
          const b = await prisma.building.findFirst({ where: { email: wallet.email }, select: { name: true } });
          if (b?.name) return { ...tx, buildingName: b.name };
        }
      } catch {}
      return tx;
    }));

    res.json(enriched);
  }));
  app.get('/api/transactions/blockchain/recent', asyncHandler(async (req, res) => {
    const { prisma } = require('./utils/prisma');
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
    const rows = await prisma.$queryRawUnsafe(`
      SELECT t.* FROM "Transaction" t
      WHERE t."txHash" IS NOT NULL
      ORDER BY COALESCE(t."verifiedAt", t."timestamp") DESC, t."timestamp" DESC
      LIMIT ${limit}
    `);
    res.json({ items: rows });
  }));
  app.get('/api/transactions/blockchain/tx/:txHash', asyncHandler(async (req, res) => {
    const { prisma } = require('./utils/prisma');
    const row = await prisma.transaction.findFirst({
      where: { txHash: req.params.txHash },
    });
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    res.json(row);
  }));
  app.get('/api/transactions/:id', asyncHandler(async (req, res) => {
    const { prisma } = require('./utils/prisma');
    const row = await prisma.transaction.findUnique({ where: { txid: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    res.json(row);
  }));
  app.get('/api/transactions/:id/verification-preview', asyncHandler(async (req, res) => {
    const { getVerificationPreview } = require('./features/blockchain/ethereumVerification.service');
    const { prisma } = require('./utils/prisma');
    const row = await prisma.transaction.findUnique({ where: { txid: req.params.id } });
    if (!row) return res.status(404).json({ error: 'Transaction not found' });
    const preview = getVerificationPreview(row);
    res.json({ transactionId: req.params.id, ...preview });
  }));
  // Direct verify endpoint (bypasses module hang / circular dependency)
  app.post('/api/transactions/:id/verify', asyncHandler(async (req, res) => {
    const { publishTransactionVerification } = require('./features/transactions/transaction.service');
    const result = await publishTransactionVerification(req.params.id, {
      force: req.query.force === 'true' || req.body?.force === true,
    });
    res.status(result.verification.published ? 201 : 200).json(result);
  }));
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/rates', rateRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/demo', demoRoutes);

  app.get('/api/health', asyncHandler(async (req, res) => {
    res.json({ status: 'ok' });
  }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
