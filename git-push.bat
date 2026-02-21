@echo off
cd c:\Users\Zhong\.openclaw\xero-feishu-bridge
git config user.email "deploy@openclaw.local"
git config user.name "Deploy"
git add -A
git commit -m "Update from local" || echo "Nothing to commit"
git pull origin main --rebase
git push origin main
pause
