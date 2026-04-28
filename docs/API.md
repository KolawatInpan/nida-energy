# API Reference (Backend)

สรุปสั้น ๆ ของทุก route ใน `backend` (base URL: `http://localhost:8000/api`)

การระบุ `Auth` หมายถึง route เรียกใช้ `auth` middleware; `Permission` ระบุ permission ที่ต้องมี (ผ่าน `requireRole`).

## Users (/api/users)
- GET /api/users — Get user list. Auth required. (permission: none, admin-only on update/delete)
- GET /api/users/:id — Get user by credId or email
- GET /api/users/building/:buildingName — Get user by building name
- GET /api/users/building/id/:buildingId — Get user by building id
- POST /api/users/register — Register new user
- POST /api/users/login — Login (returns token)
- PUT /api/users/:id — Update user (Auth + requireRole('ADMIN'))
- DELETE /api/users/:id — Delete user (Auth + requireRole('ADMIN'))

## Buildings (/api/buildings)
- GET /api/buildings — List buildings
- GET /api/buildings/:id — Get building by id
- GET /api/buildings/:buildingId/meters/count — Total meters for building
- GET /api/buildings/email/:email — Get building by owner email
- POST /api/buildings/register — Create building
- PUT /api/buildings/:id — Update building
- DELETE /api/buildings/:id — Delete building

## Meters (/api/meters)
- GET /api/meters — List meters
- GET /api/meters/building/:buildingId — Meters for building
- GET /api/meters/snid/:snid — Get meter by SNID
- GET /api/meters/approved — Approved meters
- GET /api/meters/approved/building/:buildingId — Approved meters for building
- GET /api/meters/pending — Pending meters
- GET /api/meters/rejected — Rejected meters
- POST /api/meters/register — Register meter (creates pending)
- PUT /api/meters/snid/:snid — Update meter
- DELETE /api/meters/snid/:snid — Delete meter

## Wallets (/api/wallets)
- GET /api/wallets — List wallets
- GET /api/wallets/:id — Get wallet by id
- GET /api/wallets/by-email/:email — Get wallet by owner email
- GET /api/wallets/:walletId/balance — Get wallet balance
- POST /api/wallets/register — Create wallet
- POST /api/wallets/:email/add-balance — Add balance (internal)
- POST /api/wallets/by-email/:email/topup — Top-up by email
- GET /api/wallets/:walletId/transactions — Wallet transactions
- POST /api/wallets/:walletId/recalculate-balance — Recalculate balance

## Offers (/api/offers)
- GET /api/offers — List offers
- POST /api/offers — Create new offer (sell energy)
- GET /api/offers/:id — Get offer by id
- GET /api/offers/building/:walletId — Find building by walletId

## Running meters & energy ingestion
- POST /api/runningMeters/create — Create running entry (ingest)
- POST /api/runningMeters/generate-hourly — Generate hourly entries
- POST /api/runningMeters/insert-log — Insert single running log
- POST /api/runningMeters/insert-logs-bulk — Bulk insert running logs
- POST /api/runningMeters/reset-energy-logs — Reset logs
- GET /api/energy/buildings — Get aggregated building energy

## Invoices & Receipts (/api/invoices, /api/receipts)
- GET /api/invoices/summary — Invoice summary (month/year)
- GET /api/invoices/quota-warnings — Quota warning overview
- POST /api/invoices/generate — Generate monthly invoices
- POST /api/invoices/purchase — Purchase energy (creates invoice + receipt)
- POST /api/invoices/:id/pay — Pay invoice
- GET /api/invoices — List invoices
- GET /api/invoices/:id — Get invoice by id

- GET /api/receipts — List receipts
- GET /api/receipts/:id — Get receipt
- POST /api/receipts — Create receipt
- DELETE /api/receipts/:id — Delete receipt

## Transactions (/api/transactions)
- GET /api/transactions — List transactions
- GET /api/transactions/blockchain/recent — Recent blockchain tx
- GET /api/transactions/blockchain/tx/:txHash — Get blockchain tx by hash
- POST /api/transactions — Create transaction
- GET /api/transactions/wallet/:walletId — Transactions by wallet
- GET /api/transactions/building/:buildingName — Transactions by building
- GET /api/transactions/:id/verification-preview — Preview verification payload
- POST /api/transactions/:id/verify — Publish verification (on-chain)
- GET /api/transactions/:id — Get transaction by id

## Dashboard (/api/dashboard)
- GET /api/dashboard/getBuildingById
- GET /api/dashboard/getMeterTypeById
- GET /api/dashboard/getAllMetersByBuildingName
- GET /api/dashboard/getTypeAndBuildingByMeterId
- GET /api/dashboard/getAllConsumeMeters
- GET /api/dashboard/getAllProduceMeters
- GET /api/dashboard/getAllBatteryMeters
- GET /api/dashboard/hourly
- GET /api/dashboard/daily
- GET /api/dashboard/weekly
- GET /api/dashboard/monthly
- GET /api/dashboard/search

## Rates (/api/rates)
- POST /api/rates/token — Create token rate (Auth + requireRole('ADMIN'))
- GET /api/rates/token — List token rates
- POST /api/rates/energy — Create energy rate (Auth + requireRole('ADMIN'))
- GET /api/rates/energy — List energy rates

## System (/api/system)
- POST /api/system/notifications — Create system notification (Auth + ADMIN)
- GET /api/system/notifications — List notifications (Auth + ADMIN)
- DELETE /api/system/notifications/:id — Delete notification (Auth + ADMIN)
- POST /api/system/activity — Log activity (Auth + ADMIN)
- POST /api/system/reset-database — Reset DB (Auth + ADMIN)

## Notifications (/api/notifications)
- GET /api/notifications?userId=xxx — Get notifications (userId=null returns admin list)

## Health
- GET /api/health — Health check (no auth)

## Notes
- Many routes do not enforce `auth` in the route file; some actions assume the frontend supplies a JWT and the `auth` middleware is present when needed. Where `requireRole('ADMIN')` is used, permission is enforced.
- For adding more granular permission checks, use `requirePermission('action:name')` from `backend/middleware/requirePermission.js`.

If you want, I can:
- Generate an OpenAPI (Swagger) JSON by reading JSDoc comments (some routes already include `@openapi`).
- Insert `requirePermission` on specific routes automatically (I can propose a list first).

## Swagger
- The running app exposes interactive docs at: `http://localhost:8000/api-docs`
- The OpenAPI JSON is available at: `http://localhost:8000/api-docs.json`
- To generate a static JSON file locally (written to `docs/swagger.json`), run inside `backend`:

```bash
npm run generate:swagger
```

This uses `swagger-jsdoc` to read `features/**/*.routes.js` JSDoc comments.
