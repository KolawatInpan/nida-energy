.env at /frontend/
REACT_APP_MOCKUPMODE =
REACT_APP_APIURL =
# REACT_APP_APIURL = http://localhost:3031/api
REACT_APP_DATAAPI =
REACT_APP_MONGOAPI =
REACT_APP_IOCCMDAPI =
REACT_APP_FOCUSAPI =
REACT_APP_SPHINXAPI =
REACT_APP_PARKINGAPI =
REACT_APP_PARKINGURL =

npx prisma db push
npx prisma generate

Auditorium
Bunchana
Chup
Malai
Narathip
Navamin
Nida House
Nidasumpan
Ratchaphruek
Serithai
Siam

## Docker

This repo can now run `frontend`, `backend`, and `postgres` together with Docker Compose.

### First run

1. Copy `.env.docker.example` to `.env`.
2. Adjust the values if you want different ports, passwords, or frontend API endpoints.
3. Start everything:

```bash
docker compose up --build

```

Frontend: `http://localhost:3000`

Backend: `http://localhost:8000`

Postgres: `localhost:5432`

### Database persistence

Postgres data is stored in the named Docker volume `postgres_data`, so your database will stay there even if containers are recreated.

The data will be removed only if you explicitly delete the volume, for example:

```bash
docker compose down -v

```

### Useful commands

```bash
docker compose up --build
docker compose -f docker-compose.dev.yml up --build
docker compose down
docker compose logs -f backend
docker compose exec db psql -U postgres -d energy_trading
```

### Docker dev mode

Use this when you want frontend and backend to reload automatically after file edits:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Frontend dev server: `http://localhost:3000`

Backend dev server: `http://localhost:8000`

This mode bind-mounts the source code into the containers and runs:

- frontend: `npm start`
- backend: `nodemon`

## Ethereum verification layer

Backend now has a small verification flow for existing DB transactions.

Environment variables:

```bash
ETH_RPC_URL=
ETH_PRIVATE_KEY=
ETH_CHAIN_ID=31337
ETH_EXPLORER_BASE_URL=
ETH_VERIFICATION_CONTRACT_ADDRESS=
```

Local Hardhat mode:

```bash
ETH_RPC_URL=http://blockchain:8545
ETH_PRIVATE_KEY=0x...
ETH_CHAIN_ID=31337
ETH_EXPLORER_BASE_URL=
```

Sepolia demo mode:

```bash
ETH_RPC_URL=https://sepolia.infura.io/v3/your-key
ETH_PRIVATE_KEY=0x...
ETH_CHAIN_ID=11155111
ETH_EXPLORER_BASE_URL=https://sepolia.etherscan.io/tx/
```

Preview the payload that will be hashed and published:

```bash
GET /api/transactions/:id/verification-preview
```

Publish the payload hash to Ethereum by sending a zero-value self-transaction with the hash in `data`:

```bash
POST /api/transactions/:id/verify
```

If `ETH_VERIFICATION_CONTRACT_ADDRESS` is set, the backend will call
`VerificationRegistry.recordVerification(appTxId, payloadHash)` instead of using
the self-transaction fallback. This makes each verification emit a dedicated
`TransactionVerified` event that is easier to inspect in a block explorer later.

If `ETH_RPC_URL` and `ETH_PRIVATE_KEY` are not set, the preview endpoint still works and the publish endpoint returns a non-published response with the computed payload hash.

Wallet top-up now attempts blockchain verification automatically. The response from:

```bash
POST /api/wallets/by-email/:email/topup
```

includes a `verification` object. Treat the top-up as on-chain verified when:

```json
{
  "verification": {
    "verified": true,
    "txHash": "0x..."
  }
}
```

Verification metadata is also stored back onto the `Transaction` record so wallet and transaction pages can show the on-chain status and hash later.
