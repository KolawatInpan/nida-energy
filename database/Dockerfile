FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy Prisma schema and migrations
COPY . .

# Generate Prisma client using the local schema
RUN npx prisma generate --schema=./schema.prisma

EXPOSE 5555

CMD ["sh", "-c", "npx prisma generate --schema=./schema.prisma && npx prisma studio --schema=./schema.prisma --port 5555 --hostname 0.0.0.0"]
