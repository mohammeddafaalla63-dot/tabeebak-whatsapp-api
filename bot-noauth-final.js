require('dotenv').config();
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

/**
 * NOAUTH STRATEGY - No QR Code Required
 * 
 * This uses WhatsApp's NoAuth strategy which doesn't persist sessions.
 * Each restart requires a new QR scan, but it's more reliable on Render.
 * 
 * For production 24/7 use, you need a paid service or local server.
 */

class WhatsAppBot {
    constructor() {
        console.log('🚀 Initializing WhatsApp Bot (NoAuth Strategy)...');

        this.client = new Client({
            authStrategy: new NoAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
                timeout: 90000 // 90 seconds
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
            }
        });

        this.isReady = false;
        this.qrCode = null;
        this.lastQRTime = null;
        this.messageQueue = [];
        this.isProcessingQueue = false;

        this.initialize();
    }

    initialize() {
        console.log('📱 Setting up WhatsApp client (NoAuth)...');

        // QR Code event
        this.client.on('qr', (qr) => {
            this.lastQRTime = new Date();
            console.log('═══════════════════════════════════════');
            console.log('📱 QR CODE GENERATED');
            console.log('⏰ Time:', this.lastQRTime.toISOString());
            console.log('═══════════════════════════════════════');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
            this.isReady = false;
        });

        // Ready event
        this.client.on('ready', () => {
            console.log('═══════════════════════════════════════');
            console.log('✅ WhatsApp Bot is READY!');
            console.log('═══════════════════════════════════════');
            console.log('📱 Connected as:', this.client.info?.pushname || 'Unknown');
            console.log('📞 Phone:', this.client.info?.wid?.user || 'Unknown');
            console.log('⏰ Ready at:', new Date().toISOString());
            console.log('═══════════════════════════════════════');

            this.isReady = true;
            this.qrCode = null;
            this.processQueue();
        });

        // Authenticated event
        this.client.on('authenticated', () => {
            console.log('🔐 Authentication successful!');
            console.log('⏰ Time:', new Date().toISOString());
        });

        // Auth failure
        this.client.on('auth_failure', (error) => {
            console.error('❌ Authentication failed:', error);
            this.isReady = false;
            this.qrCode = null;
        });

        // Disconnected
        this.client.on('disconnected', (reason) => {
            console.log('⚠️ Disconnected:', reason);
            console.log('⏰ Time:', new Date().toISOString());
            this.isReady = false;
            this.qrCode = null;

            // Don't auto-reconnect with NoAuth - requires new QR scan
            console.log('⚠️ NoAuth strategy - manual QR scan required to reconnect');
        });

        // Loading screen
        this.client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading: ${percent}% - ${message}`);
        });

        // State changes
        this.client.on('change_state', (state) => {
            console.log('🔄 State changed to:', state);
        });

        // Message handler
        this.client.on('message', async (message) => {
            if (message.body.toLowerCase().includes('مرحبا') ||
                message.body.toLowerCase().includes('hello')) {
                await message.reply('مرحباً بك في طبيبك! 🏥\nللمساعدة، تواصل معنا على الموقع: https://tabeebak.com');
            }
        });

        // Initialize
        console.log('🔄 Starting WhatsApp client...');
        this.client.initialize().catch(err => {
            console.error('❌ Initialization error:', err);
            console.error('Stack:', err.stack);
        });
    }

    formatPhoneNumber(phoneNumber) {
        let cleanPhone = phoneNumber.replace(/\D/g, '');

        if (cleanPhone.startsWith('0')) {
            const countryCode = process.env.COUNTRY_CODE || '249';
            cleanPhone = countryCode + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('249')) {
            cleanPhone = '249' + cleanPhone;
        }

        return cleanPhone + '@c.us';
    }

    async sendLoginLink(phoneNumber, loginUrl, userName = 'المستخدم') {
        try {
            if (!this.isReady) {
                throw new Error('WhatsApp bot is not connected. Please scan QR code first.');
            }

            const chatId = this.formatPhoneNumber(phoneNumber);
            const isRegistered = await this.client.isRegisteredUser(chatId);

            if (!isRegistered) {
                throw new Error('Phone number is not registered on WhatsApp');
            }

            const message = `
🏥 *طبيبك - Tabeebak*

مرحباً ${userName}! 👋

تم طلب تسجيل الدخول إلى حسابك.

🔗 *رابط تسجيل الدخول:*
${loginUrl}

⏰ صالح لمدة 15 دقيقة
🔒 يعمل لمرة واحدة فقط

⚠️ *تحذير:* لا تشارك هذا الرابط مع أي شخص!

إذا لم تطلب هذا الرابط، يرجى تجاهل هذه الرسالة.
            `.trim();

            await this.client.sendMessage(chatId, message);
            console.log(`✅ Login link sent to: ${phoneNumber}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error sending message:', error.message);
            throw error;
        }
    }

    async sendMessage(chatId, message, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (!this.isReady) {
                    throw new Error('Bot not ready - please scan QR code');
                }

                await this.client.sendMessage(chatId, message);
                console.log(`✅ Message sent successfully (attempt ${attempt})`);
                return { success: true };

            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error.message);

                if (attempt === retries) {
                    throw error;
                }

                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    addToQueue(phoneNumber, message) {
        this.messageQueue.push({ phoneNumber, message, timestamp: Date.now() });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0 || !this.isReady) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.messageQueue.length > 0) {
            const { phoneNumber, message } = this.messageQueue.shift();

            try {
                const chatId = this.formatPhoneNumber(phoneNumber);
                await this.sendMessage(chatId, message);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error('Queue processing error:', error);
            }
        }

        this.isProcessingQueue = false;
    }

    getStatus() {
        return {
            isReady: this.isReady,
            hasQR: !!this.qrCode,
            qrCode: this.qrCode,
            lastQRTime: this.lastQRTime,
            queueLength: this.messageQueue.length,
            info: this.isReady ? this.client.info : null,
            strategy: 'NoAuth'
        };
    }

    async getInfo() {
        if (!this.isReady) {
            return null;
        }
        return this.client.info;
    }
}

// Create singleton instance
const bot = new WhatsAppBot();

// Handle process termination
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down...');
    bot.client.destroy().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down...');
    bot.client.destroy().then(() => process.exit(0));
});

module.exports = bot;
