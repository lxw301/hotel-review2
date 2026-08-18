@echo off
chcp 65001 >nul
title 房型好评生成器
echo ========================================
echo   房型好评生成器 - 启动中...
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：
    echo   下载地址: https://nodejs.org/
    echo   安装后重新双击本文件即可。
    echo.
    pause
    exit /b
)

REM 启动服务器
echo 正在启动本地服务器...
echo 启动成功后会自动打开浏览器，请勿关闭本窗口。
echo.
start "" http://localhost:8080/index.html
node server.js
pause
