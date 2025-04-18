#!/bin/bash
set -e

# Function to check if required environment variables are set
check_required_vars() {
  local missing=false
  
  if [ -z "$DB_DATABASE" ]; then
    echo "ERROR: DB_DATABASE environment variable is not set"
    missing=true
  fi
  
  if [ -z "$DB_USERNAME" ]; then
    echo "ERROR: DB_USERNAME environment variable is not set"
    missing=true
  fi
  
  if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: DB_PASSWORD environment variable is not set"
    missing=true
  fi
  
  if [ "$missing" = true ]; then
    echo "Required environment variables are missing. Exiting."
    exit 1
  fi
}

# Function to create database schema using init_db.sql and schema.sql
setup_database() {
  local db=$1
  local user=$2
  local password=$3
  
  echo "Setting up database '$db' with user '$user'"
  
  # Step 1: Create user and database with proper permissions using init_db.sql
  echo "Creating user and database from init_db.sql..."
  PGPASSWORD=$POSTGRES_PASSWORD psql -v ON_ERROR_STOP=0 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -v DB_NAME="$db" \
    -v DB_USER="$user" \
    -v DB_PASSWORD="$password" \
    -f /app/sql/init_db.sql
  
  # Check if database now exists
  if PGPASSWORD=$POSTGRES_PASSWORD psql -lqt --username "$POSTGRES_USER" | cut -d \| -f 1 | grep -qw "$db"; then
    echo "Database '$db' successfully created or already exists"
    
    # Step 2: Apply the schema.sql with tables and indexes
    echo "Applying schema.sql to database..."
    PGPASSWORD=$password psql -v ON_ERROR_STOP=1 \
      --username "$user" \
      --dbname "$db" \
      -f /app/sql/schema.sql
      
    echo "Schema applied successfully to database '$db'"
  else
    echo "ERROR: Failed to create database '$db'"
    # Create it directly as a fallback
    echo "Trying fallback method for database creation..."
    PGPASSWORD=$POSTGRES_PASSWORD psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db;"
    PGPASSWORD=$POSTGRES_PASSWORD psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON DATABASE $db TO $user;"
    
    # Now apply the schema.sql
    echo "Applying schema.sql using fallback method..."
    PGPASSWORD=$password psql -v ON_ERROR_STOP=1 \
      --username "$user" \
      --dbname "$db" \
      -f /app/sql/schema.sql

    echo "Schema applied successfully to database '$db' using fallback method"
  fi
}

# Check if all required environment variables are set
check_required_vars

# Now proceed with database setup
if [ "$POSTGRES_DB" = "postgres" ]; then
  # Setup using provided environment variables
  echo "Setting up database with provided environment variables"
  setup_database "$DB_DATABASE" "$DB_USERNAME" "$DB_PASSWORD"
else
  echo "ERROR: POSTGRES_DB must be set to 'postgres'"
  exit 1
fi 