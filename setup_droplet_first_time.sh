#!/bin/bash

echo "1. Updating Server and Installing Dependencies..."
apt update && apt upgrade -y
apt install python3-pip python3-venv git curl nginx libgl1 -y

# ติดตั้ง Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "2. Cloning Repository..."
mkdir -p /var/www
cd /var/www
git clone https://github.com/kasapworkcontact-dot/MedAI-Verifyer.git
cd MedAI-Verifyer

echo "3. Building Frontend (React)..."
cd med-match-checker-main
npm install
npm run build
cd ..

echo "4. Setting up Python Backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

touch .env
echo "GEMINI_API_KEY=your_key_here" > .env
echo "SECRET_KEY=random_secret_token" >> .env
cd ..

echo "5. Creating Systemd Service for Backend..."
cat <<EOT | sudo tee /etc/systemd/system/medai-backend.service
[Unit]
Description=Gunicorn instance to serve MedAI Backend
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/MedAI-Verifyer/backend
Environment="PATH=/var/www/MedAI-Verifyer/backend/venv/bin"
ExecStart=/var/www/MedAI-Verifyer/backend/venv/bin/gunicorn -w 1 -b 127.0.0.1:5000 --timeout 120 app:app

[Install]
WantedBy=multi-user.target
EOT

systemctl daemon-reload
systemctl start medai-backend
systemctl enable medai-backend

echo "6. Configuring Nginx (Reverse Proxy + Static Files)..."
cat <<EOT | sudo tee /etc/nginx/sites-available/medai
server {
    listen 80;
    server_name _;

    # เสิร์ฟไฟล์ Frontend (React)
    root /var/www/MedAI-Verifyer/med-match-checker-main/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # ชี้ /api ไปที่ Python Backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT

# เปิดใช้งานค่าที่เซ็ต
ln -s /etc/nginx/sites-available/medai /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "7. Creating 2GB Swap Memory (Optional 1GB Server Fix)..."
# เปิดใช้ Swap เพื่อกัน RAM เต็ม
fallocate -l 2G /swapfile || true
chmod 600 /swapfile || true
mkswap /swapfile || true
swapon /swapfile || true
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab || true

echo "✅ Setup Complete! Your full website is running on http://YOUR_DROPLET_IP/"
echo "Don't forget to edit /var/www/MedAI-Verifyer/backend/.env with your Gemini API Key!"
