require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { supabase } = require('./supabase');

/**
 * WhatsApp Bot with Simple Supabase Session Tracking
 * 
 * This version just tracks that a session exists and is active,
 * without trying to save/restore the actual session files.
 * The LocalAuth strategy handles file persistence locally.
 */

class WhatsAppBot {
    constructor() {
        console.log('🚀 Initializing WhatsApp Bot with Supabase tracking...');

        this.sessionId = 'tabeebak-main-session';
        this.isReady = false;
        this.qrCode = null;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.client = null;

        this.initialize();
    }

    async initialize() {
        try {
            // Create WhatsApp client with LocalAuth
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: this.sessionId,
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
                        '--disable-extensions'
                    ],
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
                    timeout: 90000
                },
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
                }
            });

            this.setupEventHandlers();

            console.log('🔄 Starting WhatsApp client...');
            await this.client.initialize();

        } catch (error) {
            console.error('❌ Initialization error:', error);
            setTimeout(() => this.initialize(), 15000);
        }
    }

    setupEventHandlers() {
        // QR Code event
        this.client.on('qr', (qr) => {
            console.log('═══════════════════════════════════════');
            console.log('📱 QR CODE GENERATED');
            console.log('⏰ Time:', new Date().toISOString());
            console.log('═══════════════════════════════════════');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
            this.isReady = false;
        });

        // Authenticated event
        this.client.on('authenticated', async () => {
            console.log('🔐 Authentication successful!');
            console.log('⏰ Time:', new Date().toISOString());
            console.log('💾 Marking session as active in Supabase...');

            // Just mark session as active (don't save files)
            await this.markSessionActive();
        });

        // Ready event
        this.client.on('ready', async () => {
            console.log('═══════════════════════════════════════');
            console.log('✅ WhatsApp Bot is READY!');
            console.log('═══════════════════════════════════════');
            console.log('📱 Connected as:', this.client.info?.pushname || 'Unknown');
            console.log('📞 Phone:', this.client.info?.wid?.user || 'Unknown');
            console.log('⏰ Ready at:', new Date().toISOString());
            console.log('═══════════════════════════════════════');

            this.isReady = true;
            this.qrCode = null;

            // Update session info in Supabase
            await this.markSessionActive();

            this.processQueue();
        });

        // Auth failure
        this.client.on('auth_failure', async (error) => {
            console.error('❌ Authentication failed:', error);
            this.isReady = false;
            this.qrCode = null;

            // Mark session as inactive
            await this.markSessionInactive();
        });

        // Disconnected
        this.client.on('disconnected', async (reason) => {
            console.log('⚠️ Disconnected:', reason);
            console.log('⏰ Time:', new Date().toISOString());
            this.isReady = false;
            this.qrCode = null;

            // Mark session as inactive
            await this.markSessionInactive();

            // Try to reconnect after 10 seconds
            setTimeout(async () => {
                console.log('🔄 Attempting to reconnect...');
                try {
                    await this.client.initialize();
                } catch (err) {
                    console.error('❌ Reconnect failed:', err);
                }
            }, 10000);
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
    }

    async markSessionActive() {
        try {
            const phoneNumber = this.client.info?.wid?.user || null;

            const { error } = await supabase
                .from('whatsapp_sessions')
                .upsert({
                    session_id: this.sessionId,
                    session_data: { status: 'active', connected_at: new Date().toISOString() },
                    phone_number: phoneNumber,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'session_id'
                });

            if (error) {
                console.error('❌ Failed to mark session active:', error);
                return false;
            }

            console.log('✅ Session marked as active in Supabase');
            return true;

        } catch (error) {
            console.error('❌ Session tracking error:', error);
            return false;
        }
    }

    async markSessionInactive() {
        try {
            const { error } = await supabase
                .from('whatsapp_sessions')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', this.sessionId);

            if (!error) {
                console.log('✅ Session marked as inactive in Supabase');
            }
        } catch (error) {
            console.error('❌ Session tracking error:', error);
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
            hasQR: !!this.qrCode,
            qrCode: this.qrCode,
            queueLength: this.messageQueue.length,
            info: this.isReady && this.client ? this.client.info : null,
            strategy: 'LocalAuth with Supabase Tracking'
        };
    }

    async getInfo() {
        if (!this.isReady || !this.client) {
            return null;
        }
        return this.client.info;
    }
}

// Create singleton instance
const bot = new WhatsAppBot();

// Handle process termination
process.on('SIGTERM', async () => {
    console.log('👋 SIGTERM received, marking session inactive...');
    if (bot.client) {
        await bot.markSessionInactive();
        await bot.client.destroy();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('👋 SIGINT received, marking session inactive...');
    if (bot.client) {
        await bot.markSessionInactive();
        await bot.client.destroy();
    }
    process.exit(0);
});

module.exports = bot;
