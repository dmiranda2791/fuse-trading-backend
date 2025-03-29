-- This file is not used anymore. 
-- The database schema is now defined directly in the init-db.sh script.
-- This file is kept for reference only.

-- Fuse Trading Backend Database Initialization
-- This file contains database and user creation commands
-- Typically used in development environment

-- ===== Database and User Creation =====
-- Create user if it doesn't exist (will fail silently if user exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'DB_USER') THEN
    EXECUTE format('CREATE USER %I WITH PASSWORD %L', :'DB_USER', :'DB_PASSWORD');
  END IF;
END
$$;

-- Create database (only if it doesn't exist)
SELECT 'CREATE DATABASE ' || :'DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'DB_NAME')\gexec

-- Grant privileges
EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'DB_NAME', :'DB_USER');

-- Set database owner
EXECUTE format('ALTER DATABASE %I OWNER TO %I', :'DB_NAME', :'DB_USER');

-- Connect to the new database and grant privileges on schema public
\c :"DB_NAME"
EXECUTE format('GRANT ALL ON SCHEMA public TO %I', :'DB_USER'); 