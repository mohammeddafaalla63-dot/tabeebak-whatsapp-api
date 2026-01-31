require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'whatsapp-login-bot',
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
                    '--disable-gpu',
                    '--disable-extensions'
                ]
            }
        });

        this.isReady = false;
        this.qrCode = null;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.initialize();
    }

    initialize() {
        this.client.on('ready', () => {
            console.log('✅ WhatsApp Bot is ready and connected!');
            console.log('📱 Connected as:', this.client.info.pushname);
            this.isReady = true;
            this.qrCode = null;
            this.processQueue();
        });

        this.client.on('qr', qr => {
            console.log('📱 QR Code generated! Scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
            this.qrCode = qr;
        });

        this.client.on('authenticated', () => {
            console.log('🔐 Authentication successful!');
        });

        this.client.on('auth_failure', (error) => {
            console.error('❌ Authentication failed:', error);
            this.isReady = false;
        });

        this.client.on('disconnected', (reason) => {
            console.log('⚠️ Disconnected:', reason);
            this.isReady = false;

            // Auto-reconnect after 5 seconds
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.client.initialize();
            }, 5000);
        });

        this.client.on('message', async (message) => {
            // Auto-reply to incoming messages
            if (message.body.toLowerCase().includes('مرحبا') ||
                message.body.toLowerCase().includes('hello')) {
                await message.reply('مرحباً بك في طبيبك! 🏥\nللمساعدة، تواصل معنا على الموقع: https://tabeebak.com');
            }
        });

        this.client.initialize();
    }

    // Format phone number to WhatsApp format
    formatPhoneNumber(phoneNumber) {
        let cleanPhone = phoneNumber.replace(/\D/g, '');

        // Add country code if missing
        if (cleanPhone.startsWith('0')) {
            const countryCode = process.env.COUNTRY_CODE || '249';
            cleanPhone = countryCode + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('249')) {
            cleanPhone = '249' + cleanPhone;
        }

        return cleanPhone + '@c.us';
    }

    // Send magic link for login
    async sendLoginLink(phoneNumber, loginUrl, userName = 'المستخدم') {
        try {
            if (!this.isReady) {
                throw new Error('WhatsApp bot is not connected');
            }

            const chatId = this.formatPhoneNumber(phoneNumber);

            // Check if number is registered on WhatsApp
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

    // Send booking confirmation
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

    // Send payment receipt confirmation
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

    // Send payment verified notification
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

    // Send doctor ready notification
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

    // Generic send message with retry
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

                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // Message queue for high volume
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

                // Wait 2 seconds between messages to avoid spam detection
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
            info: this.isReady ? this.client.info : null
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

module.exports = bot;