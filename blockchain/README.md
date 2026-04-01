# Blockchain workspace

This folder runs a local Ethereum development chain for the NIDA verification flow.

## First setup

```bash
cd blockchain
npm install
```

## Run local node

```bash
npm run node
```

Hardhat will start a local JSON-RPC node at `http://127.0.0.1:8545` with funded test accounts.

Use one of the printed private keys in the root `.env`:

```env
ETH_RPC_URL=http://host.docker.internal:8545
ETH_PRIVATE_KEY=0x...
ETH_CHAIN_ID=31337
ETH_EXPLORER_BASE_URL=
ETH_VERIFICATION_CONTRACT_ADDRESS=
```

If the backend is not running in Docker, use:

```env
ETH_RPC_URL=http://127.0.0.1:8545
```

## Optional contract

Compile:

```bash
npm run compile
```

Deploy the sample verification contract to the local node:

```bash
npm run deploy:local
```

After deployment, the script writes the address to:

```text
blockchain/deployments/localhost.json
```

Copy the deployed address into the root `.env` to switch verification from
`self-transaction` mode to `contract-event` mode:

```env
ETH_VERIFICATION_CONTRACT_ADDRESS=0x...
```

## Run with Docker Compose

From the repo root:

```bash
docker compose -f docker-compose.dev.yml up --build blockchain backend frontend
```

The blockchain RPC will be available to other containers at:

```text
http://blockchain:8545
```

If you want to inspect the funded test accounts and private keys from the container logs:

```bash
docker compose -f docker-compose.dev.yml logs -f blockchain
```
