@echo off
echo ==========================================
echo Xero-Feishu Bridge (Node.js 版本)
echo ==========================================
echo.
echo 正在启动服务...
echo 服务将在 http://127.0.0.1:5001 运行
echo.
echo 飞书事件订阅地址:
echo   本地: http://127.0.0.1:5001/feishu
echo   公网: https://xxxxx.ngrok-free.app/feishu (启动 ngrok 后)
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
node server.js
pause
