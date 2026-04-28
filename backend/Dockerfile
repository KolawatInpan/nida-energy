FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
COPY database ./prisma

RUN npm install --legacy-peer-deps --no-audit --no-fund
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma generate --schema=./prisma/schema.prisma && if [ \"$RUN_PRISMA_MIGRATE\" = \"true\" ]; then npx prisma migrate deploy --schema=./prisma/schema.prisma; fi && node server.js"]
