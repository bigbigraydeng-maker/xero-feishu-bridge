@echo off
echo ==========================================
echo Xero-Feishu Bridge 启动脚本
echo ==========================================
echo.
echo 正在启动 Flask 服务...
echo 服务将在 http://127.0.0.1:5001 运行
echo.
echo 飞书事件订阅地址:
echo   本地: http://127.0.0.1:5001/feishu
echo   公网: https://xxxxx.ngrok-free.app/feishu (启动 ngrok 后)
echo.
echo ==========================================
python app.py
pause
