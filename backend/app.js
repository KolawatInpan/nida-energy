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
const { runningMeterRoutes, energyRoutes } = features.energy;
const { invoiceRoutes, receiptRoutes } = features.billing;
const { routes: transactionRoutes } = features.transactions;
const { routes: dashboardRoutes } = features.dashboard;
const { routes: rateRoutes } = features.rates;
const { routes: systemRoutes } = features.system;

function createApp() {
  const app = express();
  const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:3000';

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
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(dataModeMiddleware);

  app.use('/api/users', userRoutes);
  app.use('/api/buildings', buildingRoutes);
  app.use('/api/meters', meterRoutes);
  app.use('/api/wallets', walletRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/runningMeters', runningMeterRoutes);
  app.use('/api/energy', energyRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/receipts', receiptRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/rates', rateRoutes);
  app.use('/api/system', systemRoutes);

  app.get('/api/health', asyncHandler(async (req, res) => {
    res.json({ status: 'ok' });
  }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
