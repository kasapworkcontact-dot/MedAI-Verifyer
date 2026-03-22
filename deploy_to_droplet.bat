@echo off
color 0A
echo ===================================================
echo   MedAI DigitalOcean Auto-Deployment Script
echo   This script pushes code to GitHub and updates the Droplet
echo ===================================================

:: ใส่ IP ของ Droplet 
set DROPLET_IP=174.138.89.80
set DROPLET_USER=root

echo.
echo [1/3] Pushing latest code to GitHub...
git add .
git commit -m "deploy: update to fullstack on DigitalOcean"
git push origin main

echo.
echo [2/3] Connecting to Droplet to pull updates and restart...
:: คำสั่งนี้จะเข้าเซิร์ฟเวอร์ -> อัปเดตโค้ด -> อัปเดต Frontend -> อัปเดต Backend
ssh -i medai_key %DROPLET_USER%@%DROPLET_IP% -o StrictHostKeyChecking=no "cd /var/www/MedAI-Verifyer && git pull origin main && echo 'Building Frontend...' && cd med-match-checker-main && npm install && npm run build && echo 'Starting Backend...' && cd ../backend && source venv/bin/activate && pip install -r requirements.txt && sudo systemctl restart medai-backend && sudo systemctl restart nginx"

echo.
echo ===================================================
echo [3/3] Deployment Dones! ✅
echo Your entire system is now live at http://174.138.89.80/
echo ===================================================
pause
