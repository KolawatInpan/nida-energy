FROM node:20-bookworm-slim AS build

WORKDIR /app

# No build-time env vars — all config is runtime via docker-entrypoint.sh
ENV NODE_ENV=development
ENV GENERATE_SOURCEMAP=false
ENV CI=false
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package*.json ./
RUN npm install --include=dev --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
