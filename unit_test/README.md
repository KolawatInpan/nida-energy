# Unit Tests

This repository now has an initial `unit_test` structure for important pure logic.

Current coverage:

- `frontend/src/unit_test`
  - `energyAnalytics.test.js`
  - `meterAnalytics.test.js`
  - `dashboardCharts.test.js`
  - `walletQuota.test.js`
  - `authSession.test.js`
  - `invoiceReceiptMappers.test.js`
  - `transactionMappers.test.js`
  - tests energy analytics helpers used by report/dashboard graphs

- `frontend/src/integration_test`
  - `receipt.integration.test.js`
  - `transactionDetail.integration.test.js`
  - tests page-level rendering with mocked API/data connector responses

- `backend/unit_test`
  - `invoice.helpers.test.js`
  - `rate.helpers.test.js`
  - tests billing period/date helper logic used by invoice automation

- `backend/integration_test`
  - `health.integration.test.js`
  - tests Express app health endpoint through `backend/app.js`

Run commands:

- Frontend unit tests:
  - `cd frontend`
  - `npm run test:unit`

- Frontend integration tests:
  - `cd frontend`
  - `npm run test:integration`

- Backend unit tests:
  - `cd backend`
  - `npm run test:unit`

- Backend integration tests:
  - `cd backend`
  - `npm run test:integration`

Recommended next targets:

- invoice amount calculation helpers
- wallet/quota formatter and status helpers
- auth/session fallback helpers
- API integration flows that require DB-backed fixtures
