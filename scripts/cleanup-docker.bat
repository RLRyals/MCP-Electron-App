@echo off
REM MCP Docker Cleanup Script (Windows)
REM This script helps resolve Docker port conflicts by stopping and removing ONLY MCP-related containers
REM
REM IMPORTANT: This script ONLY affects containers with names starting with:
REM   - mcp-
REM   - typing-mind-
REM
REM Other Docker containers on your system will NOT be affected.

echo MCP Docker Cleanup Script
echo =========================
echo.
echo WARNING: This will stop and remove MCP-related containers only.
echo          Other Docker containers will NOT be affected.
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop first.
    exit /b 1
)

echo Finding MCP-related containers...
docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" --format "{{.Names}}" > temp_containers.txt

REM Check if file is empty
for %%A in (temp_containers.txt) do if %%~zA==0 (
    echo No MCP containers found. System is clean.
    del temp_containers.txt
    exit /b 0
)

echo Found containers:
type temp_containers.txt
echo.

REM Stop containers
echo Stopping containers...
for /f %%i in ('docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q') do docker stop %%i
echo Containers stopped

REM Remove containers
echo Removing containers...
for /f %%i in ('docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q') do docker rm %%i
echo Containers removed

del temp_containers.txt

echo.
echo Cleanup complete! You can now restart the MCP system.
