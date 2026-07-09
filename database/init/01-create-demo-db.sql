-- NIDA Smart Grid: Initialize both real and demo databases
-- This script runs on first Postgres container startup via /docker-entrypoint-initdb.d/

-- Create the demo database alongside the real one (real is auto-created via POSTGRES_DB)
CREATE DATABASE energy_trading_demo
  WITH OWNER = postgres
       ENCODING = 'UTF8'
       LC_COLLATE = 'en_US.utf8'
       LC_CTYPE = 'en_US.utf8'
       TEMPLATE = template0;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE energy_trading_demo TO postgres;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Database energy_trading_demo created successfully';
END $$;
