#!/bin/bash
set -e

# Function to check if required environment variables are set
check_required_vars() {
  local missing=false
  
  if [ -z "$DB_HOST" ]; then
    echo "ERROR: DB_HOST environment variable is not set"
    missing=true
  fi
  
  if [ -z "$DB_NAME" ]; then
    echo "ERROR: DB_NAME environment variable is not set"
    missing=true
  fi
  
  if [ -z "$DB_USER" ]; then
    echo "ERROR: DB_USER environment variable is not set"
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

# Function to create database schema 
init_database() {
  local host=$1
  local name=$2
  local user=$3
  local password=$4
  
  echo "Initializing database '$name' with user '$user' on host '$host'..."
  
  # Check if schema.sql file exists
  if [ ! -f "sql/schema.sql" ]; then
    echo "ERROR: sql/schema.sql file not found!"
    exit 1
  fi
  
  # Run the schema SQL on RDS
  echo "Applying schema to $name database..."
  
  # Construct the connection string
  CONNECTION_STRING="postgresql://${user}:${password}@${host}:5432/${name}"
  
  # Execute the schema.sql file
  psql "$CONNECTION_STRING" -f "sql/schema.sql"
  
  echo "Schema initialization complete!"
}

# Create sql directory if it doesn't exist
mkdir -p sql

# Get variables from Terraform outputs
export DB_HOST=$(cd terraform && terraform output -raw db_hostname)
export DB_NAME="fuse"
export DB_USER="fuse_user"
echo "Enter database password:"
read -s DB_PASSWORD

# First, check if all required environment variables are set
check_required_vars

# Now proceed with database initialization
init_database "$DB_HOST" "$DB_NAME" "$DB_USER" "$DB_PASSWORD"

echo "Database initialization completed successfully." 