@echo off
setlocal EnableExtensions
chcp 65001 >nul

rem ============================================================================
rem  【开发模式】启动脚本：vite dev(3000) + 后端 dev(4000) + cloudflared。
rem  仅限本机开发调试。公网部署请用 start-prod.bat（生产单源：Express 在 4000
rem  同时服务前端构建产物 + API + WS，隧道只指向 4000，静态资源带缓存头，
rem  且强制校验 JWT_SECRET）。把 vite dev server 暴露到公网是错误架构。
rem ============================================================================

set "ROOT_DIR=%~dp0"
set "TUNNEL_LOG=%ROOT_DIR%.logs\cloudflared.log"
if not exist "%ROOT_DIR%.logs" mkdir "%ROOT_DIR%.logs"

title HQU-CEAS Launcher

echo ========================================
echo   HQU-CEAS starting...
echo ========================================

echo.
echo [1/4] Stopping old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 :4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [2/4] Starting backend on port 4000...
start "hqu-backend" /min cmd /c "cd /d ""%ROOT_DIR%"" && npm run dev:backend"
timeout /t 3 /nobreak >nul

echo [3/4] Starting frontend on port 3000...
start "hqu-frontend" /min cmd /c "cd /d ""%ROOT_DIR%"" && npm run dev:frontend"
timeout /t 3 /nobreak >nul

echo [4/4] Starting Cloudflare Tunnel...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [ERROR] cloudflared is not installed or not in PATH.
    echo         Public URL will not be available.
    goto after_tunnel
)

if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1
start "hqu-tunnel" /min cmd /c "cloudflared tunnel run zongce > ""%TUNNEL_LOG%"" 2>&1"
call :wait_for_tunnel

:after_tunnel
echo.
echo ========================================
echo   Startup complete.
echo   Local URL:   http://localhost:3000
echo   Public URL:  https://zongce.youngspace.top
echo   Backend API: http://localhost:4000
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

echo.
echo Stopping all services...
taskkill /FI "WINDOWTITLE eq hqu-backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq hqu-frontend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq hqu-tunnel*" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 :4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
taskkill /IM cloudflared.exe /F >nul 2>&1
echo All services stopped.
timeout /t 2 /nobreak >nul
goto :eof

:wait_for_tunnel
set "TUNNEL_READY="
for /L %%i in (1,1,10) do (
    timeout /t 1 /nobreak >nul
    if exist "%TUNNEL_LOG%" (
        findstr /C:"Registered tunnel connection" "%TUNNEL_LOG%" >nul 2>&1
        if not errorlevel 1 set "TUNNEL_READY=1"
    )
)

if defined TUNNEL_READY (
    echo [OK] Cloudflare Tunnel connected.
) else (
    echo [WARN] Tunnel did not connect within 10 seconds.
    echo        Check "%TUNNEL_LOG%" for details.
)
goto :eof
