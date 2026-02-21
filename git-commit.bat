@echo off
cd c:\Users\Zhong\.openclaw\xero-feishu-bridge
git config user.email "deploy@openclaw.local"
git config user.name "Deploy"
git commit -m "Initial commit"
git branch -M main
git push -u origin main
pause
