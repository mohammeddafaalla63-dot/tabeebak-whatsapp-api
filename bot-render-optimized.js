require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppBot {
    constructor() {
        console.log('🚀 Initializing WhatsApp Bot for Render...');

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'tabeebak-bot',
                dataPath: './.wwebjs_auth'
            }),
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
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio',
                    '--no-default-browser-check',
                    '--safebrowsing-disable-auto-update',
                    '--disable-blink-features=AutomationControlled'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || '/usr/bin/chromium',
                timeout: 60000 // Increase timeout to 60 seconds
            },
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
            },
            qrMaxRetries: 5
        });

        this.isReady = false;
        this.qrCode = null;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.initializationStarted = false;

        // Delay initialization to not block server startup
        setTimeout(() => {
            this.initialize();
        }, 2000);
    }

    initialize() {
        if (this.initializationStarted) {
            console.log('⚠️ Initialization already in progress, skipping...');
            return;
        }

        this.initializationStarted = true;
        console.log('📱 Setting up WhatsApp client event handlers...');

        // Ready event - THIS IS CRITICAL
        this.client.on('ready', () => {
            console.log('═══════════════════════════════════════');
            console.log('✅ WhatsApp Bot is READY and CONNECTED!');
            console.log('═══════════════════════════════════════');
            console.log('📱 Connected as:', this.client.info.pushname);
            console.log('📞 Phone:', this.client.info.wid.user);
            console.log('⏰ Connected at:', new Date().toISOString());
            console.log('═══════════════════════════════════════');

            this.isReady = true;
            this.qrCode = null;
            this.connectionAttempts = 0;
            this.processQueue();
        });

        // QR Code event
        this.client.on('qr', (qr) => {
            const now = new Date();
            console.log('📱 QR Code generated at:', now.toISOString());
            console.log('⏰ Scan within 60 seconds!');
            console.log('🌐 Visit /api/bot/qr to see the QR code');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
            this.connectionAttempts++;

            if (this.connectionAttempts > this.maxConnectionAttempts) {
                console.log('⚠️ Too many QR attempts. Restarting client...');
                setTimeout(() => this.restartClient(), 5000);
            }
        });

        // Authenticated event
        this.client.on('authenticated', () => {
            console.log('🔐 Authentication successful!');
            console.log('⏰ Authenticated at:', new Date().toISOString());
            console.log('⏳ Waiting for "ready" event...');
        });

        // Auth failure event
        this.client.on('auth_failure', (error) => {
            console.error('❌ Authentication failed:', error);
            console.error('⏰ Failed at:', new Date().toISOString());
            this.isReady = false;
            this.qrCode = null;
        });

        // Disconnected event
        this.client.on('disconnected', (reason) => {
            console.log('⚠️ Disconnected:', reason);
            console.log('⏰ Disconnected at:', new Date().toISOString());
            this.isReady = false;
            this.qrCode = null;

            // Auto-reconnect after 10 seconds
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.initializationStarted = false;
                this.initialize();
            }, 10000);
        });

        // Loading screen event - IMPORTANT for debugging
        this.client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading: ${percent}% - ${message}`);
        });

        // Change state event - IMPORTANT for debugging
        this.client.on('change_state', (state) => {
            console.log('🔄 State changed to:', state);
        });

        // Message event
        this.client.on('message', async (message) => {
            if (message.body.toLowerCase().includes('مرحبا') ||
                message.body.toLowerCase().includes('hello')) {
                await message.reply('مرحباً بك في طبيبك! 🏥\nللمساعدة، تواصل معنا على الموقع: https://tabeebak.com');
            }
        });

        // Initialize client (non-blocking)
        console.log('🔄 Initializing WhatsApp client (non-blocking)...');
        this.client.initialize().catch(err => {
            console.error('❌ Initialization error:', err);
            console.error('Stack:', err.stack);
            this.initializationStarted = false;
            setTimeout(() => {
                console.log('🔄 Retrying initialization...');
                this.initialize();
            }, 15000);
        });
    }

    async restartClient() {
        try {
            console.log('🔄 Restarting WhatsApp client...');
            await this.client.destroy();
            this.isReady = false;
            this.qrCode = null;
            this.connectionAttempts = 0;

            setTimeout(() => {
                this.initialize();
            }, 5000);
        } catch (error) {
            console.error('❌ Error restarting client:', error);
        }
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
                throw new Error('WhatsApp bot is not connected');
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

    async sendBookingConfirmation(phoneNumber, doctorName, bookingId) {
        const chatId = this.formatPhoneNumber(phoneNumber);
        const message = `
🏥 *طبيبك - Tabeebak*

✅ تم تأكيد حجزك!
Your booking is confirmed!

👨‍⚕️ الطبيب: ${doctorName}
Doctor: ${doctorName}

🔢 رقم الحجز: ${bookingId}
Booking ID: ${bookingId}

سيتم إشعارك عندما يكون الطبيب جاهزاً.
You'll be notified when the doctor is ready.
        `.trim();

        return await this.sendMessage(chatId, message);
    }

    async sendPaymentReceiptConfirmation(phoneNumber) {
        const chatId = this.formatPhoneNumber(phoneNumber);
        const message = `
🏥 *طبيبك - Tabeebak*

✅ تم استلام إيصال الدفع
Payment receipt received

سيتم التحقق منه خلال 24 ساعة
Will be verified within 24 hours

شكراً لصبرك 🙏
Thank you for your patience
        `.trim();

        return await this.sendMessage(chatId, message);
    }

    async sendPaymentVerified(phoneNumber, doctorName) {
        const chatId = this.formatPhoneNumber(phoneNumber);
        const message = `
🏥 *طبيبك - Tabeebak*

✅ تم التحقق من الدفع!
Payment verified!

حجزك مع ${doctorName} مؤكد الآن
Your booking with ${doctorName} is now confirmed

سيتم إشعارك عندما يكون الطبيب جاهزاً
You'll be notified when the doctor is ready
        `.trim();

        return await this.sendMessage(chatId, message);
    }

    async sendDoctorReady(phoneNumber, doctorName, meetLink) {
        const chatId = this.formatPhoneNumber(phoneNumber);
        const message = `
🏥 *طبيبك - Tabeebak*

👨‍⚕️ الطبيب ${doctorName} في انتظارك!
Dr. ${doctorName} is waiting for you!

يرجى دخول غرفة الانتظار:
Please enter the waiting room:

${meetLink}

⚠️ يرجى الدخول خلال 10 دقائق
Please enter within 10 minutes
        `.trim();

        return await this.sendMessage(chatId, message);
    }

    async sendMessage(chatId, message, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                if (!this.isReady) {
                    throw new Error('Bot not ready');
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
            qrCode: this.qrCode,
            queueLength: this.messageQueue.length,
            info: this.isReady ? this.client.info : null,
            connectionAttempts: this.connectionAttempts
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
    console.log('👋 SIGTERM received, shutting down gracefully...');
    bot.client.destroy().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully...');
    bot.client.destroy().then(() => process.exit(0));
});

module.exports = bot;
