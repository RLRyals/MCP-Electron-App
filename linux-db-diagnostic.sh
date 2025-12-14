#!/bin/bash
# Linux Database Connection Diagnostic Script
# For FictionLab MCP SASL Authentication Issues

echo "=========================================="
echo "FictionLab Database Connection Diagnostic"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Check Docker status
echo -e "${YELLOW}[1/10] Checking Docker status...${NC}"
if command_exists docker; then
    if docker ps >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Docker is running${NC}"
    else
        echo -e "${RED}✗ Docker is not running or permission denied${NC}"
        echo "Try: sudo systemctl start docker"
        exit 1
    fi
else
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi
echo ""

# 2. Check FictionLab containers
echo -e "${YELLOW}[2/10] Checking FictionLab containers...${NC}"
CONTAINERS=$(docker ps --filter "name=fictionlab" --format "{{.Names}}\t{{.Status}}")
if [ -z "$CONTAINERS" ]; then
    echo -e "${RED}✗ No FictionLab containers running${NC}"
    echo "Please start FictionLab first"
    exit 1
else
    echo -e "${GREEN}✓ Found running containers:${NC}"
    echo "$CONTAINERS"
fi
echo ""

# 3. Check PostgreSQL container specifically
echo -e "${YELLOW}[3/10] Checking PostgreSQL container...${NC}"
if docker ps | grep -q "fictionlab-postgres"; then
    echo -e "${GREEN}✓ PostgreSQL container is running${NC}"
    PG_STATUS=$(docker inspect fictionlab-postgres --format='{{.State.Health.Status}}' 2>/dev/null)
    if [ "$PG_STATUS" = "healthy" ]; then
        echo -e "${GREEN}  Health: Healthy${NC}"
    else
        echo -e "${YELLOW}  Health: ${PG_STATUS}${NC}"
    fi
else
    echo -e "${RED}✗ PostgreSQL container not found${NC}"
    exit 1
fi
echo ""

# 4. Check PgBouncer container
echo -e "${YELLOW}[4/10] Checking PgBouncer container...${NC}"
if docker ps | grep -q "fictionlab-pgbouncer"; then
    echo -e "${GREEN}✓ PgBouncer container is running${NC}"
else
    echo -e "${YELLOW}⚠ PgBouncer container not running (may be optional)${NC}"
fi
echo ""

# 5. Check MCP Servers container
echo -e "${YELLOW}[5/10] Checking MCP Servers container...${NC}"
if docker ps | grep -q "fictionlab-mcp-servers"; then
    echo -e "${GREEN}✓ MCP Servers container is running${NC}"
else
    echo -e "${RED}✗ MCP Servers container not found${NC}"
fi
echo ""

# 6. Check port conflicts
echo -e "${YELLOW}[6/10] Checking for port conflicts...${NC}"
PORTS=(5432 6432 3001 50880)
PORT_NAMES=("PostgreSQL" "PgBouncer" "MCP-HTTP" "MCP-Connector")
for i in "${!PORTS[@]}"; do
    PORT=${PORTS[$i]}
    NAME=${PORT_NAMES[$i]}
    if lsof -i :$PORT >/dev/null 2>&1; then
        PROC=$(lsof -i :$PORT -t 2>/dev/null | head -1)
        if [ -n "$PROC" ]; then
            PROC_NAME=$(ps -p $PROC -o comm= 2>/dev/null)
            echo -e "${GREEN}  Port $PORT ($NAME): In use by $PROC_NAME (PID: $PROC)${NC}"
        else
            echo -e "${GREEN}  Port $PORT ($NAME): In use${NC}"
        fi
    else
        echo -e "${RED}  Port $PORT ($NAME): NOT in use (should be!)${NC}"
    fi
done
echo ""

# 7. Check PostgreSQL logs for SASL errors
echo -e "${YELLOW}[7/10] Checking PostgreSQL logs for authentication errors...${NC}"
PG_LOGS=$(docker logs fictionlab-postgres 2>&1 | grep -i "auth\|sasl\|fail" | tail -10)
if [ -n "$PG_LOGS" ]; then
    echo -e "${RED}✗ Found authentication-related log entries:${NC}"
    echo "$PG_LOGS"
else
    echo -e "${GREEN}✓ No obvious authentication errors in PostgreSQL logs${NC}"
fi
echo ""

# 8. Check MCP Servers logs for connection errors
echo -e "${YELLOW}[8/10] Checking MCP Servers logs for errors...${NC}"
MCP_LOGS=$(docker logs fictionlab-mcp-servers 2>&1 | grep -i "error\|sasl\|auth\|connection" | tail -10)
if [ -n "$MCP_LOGS" ]; then
    echo -e "${RED}✗ Found error-related log entries:${NC}"
    echo "$MCP_LOGS"
else
    echo -e "${GREEN}✓ No obvious errors in MCP Servers logs${NC}"
fi
echo ""

# 9. Test PostgreSQL connection from MCP container
echo -e "${YELLOW}[9/10] Testing database connection from MCP container...${NC}"
TEST_RESULT=$(docker exec fictionlab-mcp-servers sh -c 'node -e "
const { Client } = require(\"pg\");
const client = new Client({
    host: process.env.DB_HOST || \"postgres\",
    port: process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || \"mcp_writing_db\",
    user: process.env.POSTGRES_USER || \"writer\",
    password: process.env.POSTGRES_PASSWORD
});
client.connect()
    .then(() => {
        console.log(\"✓ Database connection successful\");
        return client.end();
    })
    .catch(err => {
        console.error(\"✗ Database connection failed:\", err.message);
        process.exit(1);
    });
"' 2>&1)

if echo "$TEST_RESULT" | grep -q "successful"; then
    echo -e "${GREEN}$TEST_RESULT${NC}"
else
    echo -e "${RED}$TEST_RESULT${NC}"
fi
echo ""

# 10. Check environment variables in MCP container
echo -e "${YELLOW}[10/10] Checking database environment variables in MCP container...${NC}"
ENV_VARS=$(docker exec fictionlab-mcp-servers env | grep -E "POSTGRES|DB_" | sed 's/PASSWORD=.*/PASSWORD=***/')
if [ -n "$ENV_VARS" ]; then
    echo -e "${GREEN}✓ Environment variables found:${NC}"
    echo "$ENV_VARS"
else
    echo -e "${RED}✗ No database environment variables found!${NC}"
fi
echo ""

# Summary and recommendations
echo "=========================================="
echo "DIAGNOSTIC SUMMARY"
echo "=========================================="
echo ""

# Check if critical issues found
CRITICAL=0

if ! docker ps | grep -q "fictionlab-postgres"; then
    echo -e "${RED}✗ CRITICAL: PostgreSQL container not running${NC}"
    CRITICAL=1
fi

if ! docker ps | grep -q "fictionlab-mcp-servers"; then
    echo -e "${RED}✗ CRITICAL: MCP Servers container not running${NC}"
    CRITICAL=1
fi

if echo "$TEST_RESULT" | grep -q "failed"; then
    echo -e "${RED}✗ CRITICAL: Database connection test failed${NC}"
    echo "  This is likely the root cause of the SASL authentication error"
    CRITICAL=1
fi

if [ $CRITICAL -eq 0 ]; then
    echo -e "${GREEN}✓ No critical issues detected${NC}"
    echo ""
    echo "If you're still experiencing SASL errors, please share this output with support."
else
    echo ""
    echo -e "${YELLOW}RECOMMENDED ACTIONS:${NC}"
    echo "1. Stop FictionLab: docker compose down"
    echo "2. Check environment file: cat ~/.config/fictionlab/.env"
    echo "3. Restart FictionLab from the application"
    echo "4. If problem persists, run: docker compose logs -f"
fi

echo ""
echo "=========================================="
echo "To save this output to a file, run:"
echo "  ./linux-db-diagnostic.sh > diagnostic-output.txt 2>&1"
echo "=========================================="
