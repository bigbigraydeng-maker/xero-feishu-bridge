@echo off
echo ==========================================
echo Xero-Feishu Bridge 部署助手
echo ==========================================
echo.
echo 此脚本将帮助您完成 Git 提交
echo.
echo 请按以下步骤手动操作：
echo.
echo 1. 打开命令行，进入项目目录：
echo    cd c:\Users\Zhong\.openclaw\xero-feishu-bridge
echo.
echo 2. 配置 Git 用户：
echo    git config user.email "deploy@openclaw.local"
echo    git config user.name "Deploy"
echo.
echo 3. 提交代码：
echo    git commit -m "Initial commit"
echo.
echo 4. 在 GitHub 创建新仓库，然后关联：
echo    git remote add origin https://github.com/YOUR_USERNAME/xero-feishu-bridge.git
echo.
echo 5. 推送到 GitHub：
echo    git push -u origin main
echo.
echo ==========================================
echo 或者使用 Render 的 GitHub 集成直接部署
echo ==========================================
pause
