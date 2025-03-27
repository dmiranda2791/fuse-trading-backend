-- Fuse Trading Backend Database Schema
-- This file contains both user/database creation and table schema

-- ===== Database and User Creation =====
-- Note: These commands will be processed with environment variables from init-db.sh
-- DO NOT change the variable names

-- Create user with password (will fail silently if user exists)
CREATE USER :DB_USER WITH PASSWORD :'DB_PASSWORD';

-- Create database (only if it doesn't exist)
SELECT 'CREATE DATABASE ' || :'DB_NAME' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE :DB_NAME TO :DB_USER;

-- Set database owner
ALTER DATABASE :DB_NAME OWNER TO :DB_USER;

-- Connect to the new database and grant privileges on schema public
\c :DB_NAME
GRANT ALL ON SCHEMA public TO :DB_USER;

-- ===== Table Schemas =====

-- Stock Entity
CREATE TABLE IF NOT EXISTS stocks (
  symbol VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 4) NOT NULL,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio Entity
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_stock_unique UNIQUE (user_id, symbol)
);

-- Trade Entity
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  reason VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_user_timestamp ON trades(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_stocks_last_fetched_at ON stocks(last_fetched_at);