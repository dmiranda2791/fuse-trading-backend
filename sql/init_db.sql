-- Fuse Trading Backend Database Initialization
-- This file contains database and user creation commands
-- Typically used in development environment

-- ===== Database and User Creation =====
-- Note: These commands will be processed with environment variables

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