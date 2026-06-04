#!/bin/sh
# Generate runtime config from environment variables
# This allows changing BACKEND_URL without rebuilding the image

BACKEND_URL="${BACKEND_URL:-http://localhost:8000/api/}"
# Remove trailing slash for consistency
BACKEND_URL="${BACKEND_URL%/}"

cat > /usr/share/nginx/html/config.js << EOF
// Auto-generated at container startup — edit .env on VM and restart container to change
window.__RUNTIME_CONFIG__ = {
  BACKEND_URL: "${BACKEND_URL}",
};
EOF

echo "[entrypoint] Runtime config written: BACKEND_URL=${BACKEND_URL}"

# Start nginx
exec nginx -g "daemon off;"
