FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 8545

CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
