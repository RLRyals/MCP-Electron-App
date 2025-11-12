@echo off
REM Debug Docker Port Conflicts
REM This script helps diagnose and fix Docker port conflicts for the MCP system

echo ================================================
echo Docker Port Conflict Diagnostic Tool
echo ================================================
echo.

REM Check if Docker is running
echo 1. Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running
    echo         Please start Docker Desktop and try again
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Check for MCP containers
echo 2. Checking for MCP containers...
docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" --format "{{.ID}} {{.Names}} {{.Status}}" > temp_containers.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to check containers
    del temp_containers.txt 2>nul
    exit /b 1
)

set FOUND_CONTAINERS=0
for /f "tokens=*" %%a in (temp_containers.txt) do (
    set FOUND_CONTAINERS=1
    echo    %%a
)

if %FOUND_CONTAINERS%==0 (
    echo [OK] No MCP containers found
) else (
    echo [WARNING] Found MCP containers ^(listed above^)
)
del temp_containers.txt
echo.

REM Check ports
echo 3. Checking port usage...
echo    Note: Windows port checking requires additional tools
echo    Checking Docker containers on common MCP ports...

docker ps --format "{{.Names}} {{.Ports}}" | findstr /C:"5432" /C:"50880" /C:"3000" > temp_ports.txt
if %errorlevel% neq 0 (
    echo [OK] No containers found using MCP ports
) else (
    echo [WARNING] Containers using MCP ports:
    type temp_ports.txt
)
del temp_ports.txt 2>nul
echo.

REM Check Docker networks
echo 4. Checking Docker networks...
docker network ls --filter "name=mcp" --format "{{.ID}} {{.Name}}" > temp_networks.txt
set FOUND_NETWORKS=0
for /f "tokens=*" %%a in (temp_networks.txt) do (
    set FOUND_NETWORKS=1
    echo    %%a
)

if %FOUND_NETWORKS%==0 (
    echo [OK] No MCP networks found
) else (
    echo [WARNING] Found MCP networks ^(listed above^)
)
del temp_networks.txt
echo.

REM Offer cleanup
echo 5. Cleanup Options
echo ==================
echo.

docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q > temp_cleanup.txt
set NEED_CLEANUP=0
for /f %%a in (temp_cleanup.txt) do set NEED_CLEANUP=1
del temp_cleanup.txt

if %NEED_CLEANUP%==1 (
    set /p CLEANUP="Would you like to clean up MCP containers? (y/n): "
    if /i "%CLEANUP%"=="y" (
        echo Stopping MCP containers...
        for /f %%i in ('docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q') do docker stop %%i

        echo Removing MCP containers...
        for /f %%i in ('docker ps -a --filter "name=mcp-" --filter "name=typing-mind-" -q') do docker rm -f %%i

        echo [OK] Cleanup complete

        echo Waiting 3 seconds for ports to be released...
        timeout /t 3 /nobreak >nul

        echo.
        echo 6. Cleanup successful!
        echo    You can now try starting the MCP system again.
    )
) else (
    echo [OK] No cleanup needed - no MCP containers found
)

echo.
echo ================================================
echo Diagnostic complete!
echo.
echo If you're still experiencing port conflicts:
echo 1. Restart Docker Desktop
echo 2. Run this script again
echo 3. Check for other applications using ports 5432, 50880, or 3000
echo.
pause
