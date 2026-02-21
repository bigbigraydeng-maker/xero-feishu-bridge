@echo off
echo ==========================================
echo ngrok 配置向导
echo ==========================================
echo.
echo ngrok 需要 authtoken 才能运行
echo.
echo 请按以下步骤操作：
echo 1. 访问 https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. 注册/登录 ngrok 账号
echo 3. 复制你的 authtoken
echo 4. 在下方输入：
echo.
set /p TOKEN="请输入 ngrok authtoken: "
c:\Users\Zhong\.openclaw\ngrok\ngrok.exe config add-authtoken %TOKEN%
echo.
echo ==========================================
echo 配置完成！现在可以运行 start-ngrok.bat 了
echo ==========================================
pause
