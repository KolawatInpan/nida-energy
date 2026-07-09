FROM node:20-bookworm-slim

WORKDIR /app

# Install required system deps for Puppeteer/Chromium
RUN apt-get update -y \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		fonts-liberation \
		libnss3 \
		libatk1.0-0 \
		libatk-bridge2.0-0 \
		libcups2 \
		libx11-6 \
		libx11-xcb1 \
		libxcomposite1 \
		libxdamage1 \
		libxrandr2 \
		libgbm1 \
		libasound2 \
		libxshmfence1 \
		libxss1 \
		libxtst6 \
		libxfixes3 \
		libxrender1 \
		libxext6 \
		libgtk-3-0 \
		libglib2.0-0 \
		libgdk-pixbuf2.0-0 \
		libpangocairo-1.0-0 \
		libatspi2.0-0 \
		libdrm2 \
		libxkbcommon0 \
		libwayland-client0 \
		libdbus-1-3 \
		libexpat1 \
		libfontconfig1 \
		libgconf-2-4 \
		libnspr4 \
		libpango-1.0-0 \
		libxcursor1 \
		libxi6 \
		libxcb1 \
		libxcb-dri3-0 \
		libxcb-dri2-0 \
		wget \
		gnupg \
		lsb-release \
		chromium \
	&& rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
COPY database ./prisma

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install --legacy-peer-deps --no-audit --no-fund --unsafe-perm
RUN ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

COPY backend/ ./

EXPOSE 8000
 
CMD ["sh", "-c", "sh /app/prisma/push-both-dbs.sh --accept-data-loss --schema /app/prisma/schema.prisma && ./node_modules/.bin/prisma generate --schema=/app/prisma/schema.prisma && if [ \"$RUN_PRISMA_MIGRATE\" = \"true\" ]; then sh /app/prisma/migrate-both-dbs.sh --schema /app/prisma/schema.prisma; fi && node server.js"]
