#!/usr/bin/env bash
# Render build script for WhatsApp Web.js with Puppeteer

echo "📦 Installing Chromium and dependencies..."

# Install Chromium and required libraries
apt-get update
apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates

echo "✅ Chromium installed successfully"

# Install Node.js dependencies
echo "📦 Installing npm packages..."
npm install

echo "✅ Build complete!"
