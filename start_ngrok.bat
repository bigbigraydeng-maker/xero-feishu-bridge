@echo off
echo ==========================================
echo ngrok 公网穿透启动脚本
echo ==========================================
echo.
echo 正在启动 ngrok，将本地 5001 端口暴露到公网...
echo.
echo 请等待显示 Forwarding 地址
echo 然后将 https 地址填入飞书事件订阅配置
echo.
echo 示例输出:
echo   Forwarding https://xxxxx.ngrok-free.app -> http://localhost:5001
echo.
echo 飞书回调地址格式:
echo   https://xxxxx.ngrok-free.app/feishu
echo.
echo ==========================================
c:\Users\Zhong\.openclaw\ngrok\ngrok.exe http 5001
pause
