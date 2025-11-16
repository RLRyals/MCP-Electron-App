#!/bin/bash
# Setup script to configure pgbouncer with correct password hash

set -e

# Load environment variables from .env file
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create a .env file based on .env.test"
    exit 1
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Generate MD5 hash for pgbouncer
# Format: "md5" + md5(password + username)
HASH=$(echo -n "${POSTGRES_PASSWORD}${POSTGRES_USER}" | md5sum | awk '{print $1}')
MD5_HASH="md5${HASH}"

# Create userlist.txt
echo "\"${POSTGRES_USER}\" \"${MD5_HASH}\"" > userlist.txt

# Update pgbouncer.ini with correct database name
sed -i "s/dbname=.*/dbname=${POSTGRES_DB}/" pgbouncer.ini

echo "✓ PgBouncer configuration updated successfully!"
echo "  - Database: ${POSTGRES_DB}"
echo "  - User: ${POSTGRES_USER}"
echo "  - Userlist.txt created with MD5 hash"
echo ""
echo "You can now run: docker-compose up -d"
