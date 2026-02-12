require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;

// Bot will be initialized AFTER server starts
let bot = null;
let botInitializing = false;

// Rate limiting storage
const rateLimitStore = new Map();

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

console.log('🚀 Starting Tabeebak WhatsApp API Server...');
console.log('📱 Country Code:', process.env.COUNTRY_CODE || '249');
console.log('🌐 Website URL:', process.env.WEBSITE_URL || 'Not set');
console.log('⚡ Server will start immediately, WhatsApp will initialize in background');

// Rate limiting function
function checkRateLimit(phone) {
    const now = Date.now();
    const key = `login_${phone}`;
    const limit = rateLimitStore.get(key) || { count: 0, resetTime: now + 3600000 };

    if (now > limit.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + 3600000 });
        return { allowed: true, remaining: 2 };
    }

    if (limit.count >= 3) {
        return { allowed: false, remaining: 0, resetTime: limit.resetTime };
    }

    limit.count++;
    rateLimitStore.set(key, limit);
    return { allowed: true, remaining: 3 - limit.count };
}

// Clean up old rate limit entries every hour
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 3600000);

// Initialize bot in background (non-blocking)
function initializeBot() {
    if (botInitializing) {
        console.log('⚠️ Bot initialization already in progress');
        return;
    }

    botInitializing = true;
    console.log('📱 Starting WhatsApp bot initialization in background...');

    try {
        bot = require('./bot-render-optimized');
        console.log('✅ Bot module loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load bot module:', error.message);
        botInitializing = false;
        // Retry after 30 seconds
        setTimeout(initializeBot, 30000);
    }
}

// ═══════════════════════════════════════
// Home Page
// ═══════════════════════════════════════
app.get('/', (req, res) => {
    const botStatus = bot ? bot.getStatus() : { isReady: false, queueLength: 0 };
    res.json({
        status: 'online',
        service: 'Tabeebak WhatsApp API',
        version: '3.0.0',
        serverUptime: process.uptime(),
        whatsapp: {
            connected: botStatus.isReady,
            initializing: botInitializing && !botStatus.isReady,
            queueLength: botStatus.queueLength
        },
        endpoints: {
            'POST /api/auth/request-login': 'Request magic link login',
            'POST /api/notifications/booking-confirmed': 'Send booking confirmation',
            'POST /api/notifications/payment-received': 'Send payment receipt confirmation',
            'POST /api/notifications/payment-verified': 'Send payment verified notification',
            'POST /api/notifications/doctor-ready': 'Send doctor ready notification',
            'GET /api/bot/status': 'Bot connection status',
            'GET /api/bot/qr': 'Display QR code for setup',
            'GET /health': 'Health check'
        }
    });
});

// ═══════════════════════════════════════
// API: Request Magic Link Login
// ═══════════════════════════════════════
app.post('/api/auth/request-login', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Check if bot is ready
        if (!bot) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service is initializing. Please try again in a moment.'
            });
        }

        const botStatus = bot.getStatus();
        if (!botStatus.isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service is not connected yet. Please scan QR code at /api/bot/qr'
            });
        }

        // Check rate limit
        const rateLimit = checkRateLimit(phone);
        if (!rateLimit.allowed) {
            const resetDate = new Date(rateLimit.resetTime);
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                resetTime: resetDate.toISOString()
            });
        }

        console.log(`📝 Login request from: ${phone}`);

        // Generate magic link token
        const loginToken = uuidv4();
        const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3000';
        const loginUrl = `${websiteUrl}/auth/verify?token=${loginToken}`;

        // Send via WhatsApp
        try {
            await bot.sendLoginLink(phone, loginUrl, 'المستخدم');

            res.json({
                success: true,
                message: 'Login link sent to WhatsApp!',
                expiresIn: '15 minutes',
                remaining: rateLimit.remaining
            });
        } catch (botError) {
            console.error('❌ WhatsApp send error:', botError.message);
            res.status(500).json({
                success: false,
                error: botError.message.includes('not registered')
                    ? 'Phone number is not registered on WhatsApp'
                    : 'Failed to send WhatsApp message'
            });
        }

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ═══════════════════════════════════════
// API: Send Booking Confirmation
// ═══════════════════════════════════════
app.post('/api/notifications/booking-confirmed', async (req, res) => {
    try {
        const { phone, doctorName, bookingId } = req.body;

        if (!phone || !doctorName || !bookingId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        if (!bot || !bot.getStatus().isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service not ready'
            });
        }

        await bot.sendBookingConfirmation(phone, doctorName, bookingId);
        res.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════
// API: Send Payment Receipt Confirmation
// ═══════════════════════════════════════
app.post('/api/notifications/payment-received', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'Phone number required'
            });
        }

        if (!bot || !bot.getStatus().isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service not ready'
            });
        }

        await bot.sendPaymentReceiptConfirmation(phone);
        res.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════
// API: Send Payment Verified
// ═══════════════════════════════════════
app.post('/api/notifications/payment-verified', async (req, res) => {
    try {
        const { phone, doctorName } = req.body;

        if (!phone || !doctorName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        if (!bot || !bot.getStatus().isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service not ready'
            });
        }

        await bot.sendPaymentVerified(phone, doctorName);
        res.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════
// API: Send Doctor Ready Notification
// ═══════════════════════════════════════
app.post('/api/notifications/doctor-ready', async (req, res) => {
    try {
        const { phone, doctorName, meetLink } = req.body;

        if (!phone || !doctorName || !meetLink) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        if (!bot || !bot.getStatus().isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp service not ready'
            });
        }

        await bot.sendDoctorReady(phone, doctorName, meetLink);
        res.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════
// API: Bot Status
// ═══════════════════════════════════════
app.get('/api/bot/status', (req, res) => {
    if (!bot) {
        return res.json({
            success: true,
            isReady: false,
            initializing: botInitializing,
            message: 'Bot is initializing...'
        });
    }

    const status = bot.getStatus();
    res.json({
        success: true,
        isReady: status.isReady,
        hasQR: !!status.qrCode,
        queueLength: status.queueLength,
        info: status.info
    });
});

// ═══════════════════════════════════════
// API: Display QR Code
// ═══════════════════════════════════════
app.get('/api/bot/qr', (req, res) => {
    if (!bot) {
        return res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="5">
    <title>جاري التحميل</title>
    <style>
        body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #3AAFA9 0%, #2B7A78 100%);
            color: white;
            text-align: center;
        }
        .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3AAFA9;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div>
        <div class="loader"></div>
        <h2>⏳ جاري تحميل WhatsApp Bot...</h2>
        <p>Please wait while the bot initializes...</p>
    </div>
</body>
</html>
        `);
    }

    const status = bot.getStatus();

    if (status.isReady) {
        return res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>البوت متصل</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #3AAFA9 0%, #2B7A78 100%);
            margin: 0;
        }
        .container {
            background: white;
            padding: 50px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #25D366; margin: 0; }
        p { color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ البوت متصل بنجاح!</h1>
        <p>WhatsApp Bot is Connected</p>
        <p style="margin-top: 20px;">يمكنك إغلاق هذه الصفحة</p>
    </div>
</body>
</html>
        `);
    }

    if (!status.qrCode) {
        return res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="3">
    <title>جاري التحميل</title>
    <style>
        body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f5f5f5;
        }
        .loader {
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3AAFA9;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div>
        <div class="loader"></div>
        <h2 style="text-align: center;">⏳ جاري إنشاء QR Code...</h2>
    </div>
</body>
</html>
        `);
    }

    res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>QR Code - Tabeebak WhatsApp</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #3AAFA9 0%, #2B7A78 100%);
            margin: 0;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
        }
        h2 { color: #333; margin-bottom: 20px; font-size: 24px; }
        #qr { margin: 30px 0; }
        .instructions {
            text-align: right;
            margin-top: 30px;
            line-height: 2;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
        }
        .instructions strong {
            color: #3AAFA9;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>📱 امسح هذا الكود من WhatsApp</h2>
        <div id="qr"></div>
        <div class="instructions">
            <strong>الخطوات:</strong><br>
            1. افتح WhatsApp على هاتفك<br>
            2. اذهب إلى الإعدادات ⚙️<br>
            3. اضغط "الأجهزة المرتبطة"<br>
            4. اضغط "ربط جهاز"<br>
            5. امسح الكود أعلاه 📷
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>
        new QRCode(document.getElementById("qr"), {
            text: "${status.qrCode}",
            width: 300,
            height: 300
        });
        
        setInterval(async () => {
            try {
                const res = await fetch('/api/bot/status');
                const data = await res.json();
                if (data.isReady) {
                    location.reload();
                }
            } catch (error) {
                console.error('Status check failed:', error);
            }
        }, 5000);
    </script>
</body>
</html>
    `);
});

// ═══════════════════════════════════════
// Health Check - CRITICAL FOR RENDER
// ═══════════════════════════════════════
app.get('/health', (req, res) => {
    const botStatus = bot ? bot.getStatus() : { isReady: false };
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        whatsapp: {
            connected: botStatus.isReady,
            initializing: botInitializing && !botStatus.isReady
        }
    });
});

// ═══════════════════════════════════════
// Error Handler
// ═══════════════════════════════════════
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ═══════════════════════════════════════
// Start Server IMMEDIATELY
// ═══════════════════════════════════════
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Server is LIVE on port: ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log('═══════════════════════════════════════');
    console.log('');

    // Initialize bot AFTER server is running
    setTimeout(() => {
        console.log('📱 Now initializing WhatsApp bot in background...');
        initializeBot();
    }, 3000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

module.exports = app;
