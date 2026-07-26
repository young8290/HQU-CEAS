@echo off
setlocal EnableExtensions
chcp 65001 >nul

rem ============================================================================
rem  HQU-CEAS 生产模式启动脚本（单源部署，PLAN_V2 §1/§5.7/§6）
rem
rem  流程：检查 JWT_SECRET → 构建前后端 → NODE_ENV=production 单进程启动
rem        （Express 同时服务 API + WebSocket + 前端构建产物，端口 4000）
rem        → cloudflared 隧道只暴露 http://localhost:4000 这一个源。
rem
rem  与 start.bat 的区别：
rem    - start.bat 是开发模式（vite dev 3000 + 后端 4000），仅限本机调试；
rem    - 公网部署必须用本脚本：不暴露 vite dev server，静态资源带 immutable
rem      缓存头，且 JWT_SECRET 未配置时后端直接拒绝启动（fail-fast）。
rem
rem  cloudflared 前提：%USERPROFILE%\.cloudflared\config.yml 中 zongce 隧道的
rem  ingress 必须指向 http://localhost:4000（单源；不要再指向 3000）。
rem ============================================================================

set "ROOT_DIR=%~dp0"
set "ENV_FILE=%ROOT_DIR%packages\backend\.env"
set "TUNNEL_LOG=%ROOT_DIR%.logs\cloudflared.log"
if not exist "%ROOT_DIR%.logs" mkdir "%ROOT_DIR%.logs"

title HQU-CEAS Production Launcher

echo ========================================
echo   HQU-CEAS 生产模式启动中...
echo ========================================

rem ── [1/5] JWT_SECRET 检查（后端在生产模式下缺失会 fail-fast，这里提前给出友好提示）──
echo.
echo [1/5] 检查 JWT_SECRET...
if defined JWT_SECRET goto jwt_ok
if not exist "%ENV_FILE%" goto jwt_missing
findstr /B /C:"JWT_SECRET=" "%ENV_FILE%" >nul 2>&1 || goto jwt_missing
findstr /C:"replace-with-a-long-random-secret" "%ENV_FILE%" >nul 2>&1 && goto jwt_placeholder
echo       [OK] 将使用 packages\backend\.env 中的 JWT_SECRET。
goto jwt_ok

:jwt_missing
echo.
echo [错误] 未配置 JWT_SECRET（环境变量与 packages\backend\.env 均未设置）。
goto jwt_help

:jwt_placeholder
echo.
echo [错误] packages\backend\.env 中的 JWT_SECRET 仍是示例占位值，禁止用于生产。
goto jwt_help

:jwt_help
echo        生产环境必须设置强随机密钥，生成命令：
echo          node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
echo        将输出填入 packages\backend\.env 的 JWT_SECRET= 后再运行本脚本。
pause
exit /b 1

:jwt_ok

rem ── [2/5] 构建（后端 tsc → dist/，前端 vite build → dist/；失败则终止）─────────
echo.
echo [2/5] 构建前后端（npm run build）...
pushd "%ROOT_DIR%"
call npm run build
if errorlevel 1 (
    popd
    echo.
    echo [错误] 构建失败，已终止启动。请查看上方输出修复后重试。
    pause
    exit /b 1
)
popd

rem ── [3/5] 释放 4000 端口（停掉旧的 dev 后端或旧生产实例）───────────────────────
echo.
echo [3/5] 停止占用 4000 端口的旧进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
rem 提醒：若 3000 端口仍有 vite dev 在跑，公网隧道不应指向它（本脚本不代杀）。
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1 && (
    echo       [提示] 检测到 3000 端口仍在运行（vite dev）。生产部署不需要它，
    echo              且 cloudflared 隧道必须指向 4000，请勿将 3000 暴露到公网。
)

rem ── [4/5] 生产模式单进程启动（NODE_ENV=production，API+WS+前端静态同源 4000）──
echo.
echo [4/5] 以生产模式启动后端（端口 4000）...
set "NODE_ENV=production"
start "hqu-prod" /min cmd /c "cd /d ""%ROOT_DIR%"" && npm run start:prod -w packages/backend"

rem 等待健康检查通过（最多 20 秒）
set "BACKEND_READY="
for /L %%i in (1,1,20) do (
    if not defined BACKEND_READY (
        timeout /t 1 /nobreak >nul
        curl -s -o nul http://localhost:4000/api/health && set "BACKEND_READY=1"
    )
)
if defined BACKEND_READY (
    echo       [OK] 后端健康检查通过：http://localhost:4000/api/health
) else (
    echo       [警告] 20 秒内未通过健康检查。常见原因：JWT_SECRET 未配置（生产
    echo              模式 fail-fast）、构建产物缺失或端口被占用。
    echo              可在 "hqu-prod" 窗口查看启动日志。
)

rem ── [5/5] cloudflared 隧道（单源：只指向 http://localhost:4000）────────────────
echo.
echo [5/5] 启动 Cloudflare Tunnel...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo       [警告] 未安装 cloudflared 或不在 PATH 中，跳过公网隧道。
    echo              本机访问：http://localhost:4000
    goto after_tunnel
)

if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1
start "hqu-tunnel" /min cmd /c "cloudflared tunnel run zongce > ""%TUNNEL_LOG%"" 2>&1"
call :wait_for_tunnel

:after_tunnel
echo.
echo ========================================
echo   生产模式启动完成（单源部署）。
echo   本机访问:  http://localhost:4000
echo   公网访问:  https://zongce.youngspace.top
echo   （前端页面、/api、/ws 均由 4000 同源提供）
echo ========================================
echo.
echo 按任意键停止全部服务...
pause >nul

echo.
echo 正在停止全部服务...
taskkill /FI "WINDOWTITLE eq hqu-prod*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq hqu-tunnel*" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
taskkill /IM cloudflared.exe /F >nul 2>&1
echo 全部服务已停止。
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
    echo       [OK] Cloudflare Tunnel 已连接。
) else (
    echo       [警告] 10 秒内隧道未连接，请检查 "%TUNNEL_LOG%"。
)
goto :eof
