require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { supabase, userService } = require('./supabase');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting storage (in-memory, use Redis in production)
const rateLimitStore = new Map();

// Middleware
app.use(cors({
    origin: process.env.WEBSITE_URL || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

console.log('🚀 Starting Tabeebak WhatsApp API Server...');
console.log('📱 Country Code:', process.env.COUNTRY_CODE);
console.log('🌐 Website URL:', process.env.WEBSITE_URL);

// Rate limiting function
function checkRateLimit(phone) {
    const now = Date.now();
    const key = `login_${phone}`;
    const limit = rateLimitStore.get(key) || { count: 0, resetTime: now + 3600000 }; // 1 hour

    if (now > limit.resetTime) {
        // Reset counter
        rateLimitStore.set(key, { count: 1, resetTime: now + 3600000 });
        return { allowed: true, remaining: 2 };
    }

    if (limit.count >= 3) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: limit.resetTime
        };
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

// ═══════════════════════════════════════
// Home Page
// ═══════════════════════════════════════
app.get('/', (req, res) => {
    const botStatus = bot.getStatus();
    res.json({
        status: 'online',
        service: 'Tabeebak WhatsApp API',
        version: '1.0.0',
        whatsapp: {
            connected: botStatus.isReady,
            queueLength: botStatus.queueLength
        },
        endpoints: {
            'POST /api/auth/request-login': 'Request magic link login',
            'GET /api/auth/verify/:token': 'Verify magic link token',
            'POST /api/notifications/booking-confirmed': 'Send booking confirmation',
            'POST /api/notifications/payment-received': 'Send payment receipt confirmation',
            'POST /api/notifications/payment-verified': 'Send payment verified notification',
            'POST /api/notifications/doctor-ready': 'Send doctor ready notification',
            'GET /api/bot/status': 'Bot connection status',
            'GET /api/bot/qr': 'Display QR code for setup',
            'GET /api/bot/info': 'Bot information',
            'GET /health': 'Health check'
        }
    });
});

// ═══════════════════════════════════════
// API: طلب رابط تسجيل الدخول
// ═══════════════════════════════════════
app.post('/api/auth/request-login', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'رقم الهاتف مطلوب'
            });
        }

        const botStatus = bot.getStatus();
        if (!botStatus.isReady) {
            return res.status(503).json({
                success: false,
                error: 'البوت غير متصل. حاول مرة أخرى بعد قليل.'
            });
        }

        console.log(`📝 طلب من: ${phone}`);

        let user = await userService.findByPhone(phone);

        const loginToken = uuidv4();
        const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

        if (!user) {
            user = await userService.create({
                phone,
                login_token: loginToken,
                token_expiry: tokenExpiry.toISOString(),
                name: 'مستخدم جديد'
            });
            console.log(`👤 مستخدم جديد: ${phone}`);
        } else {
            user = await userService.update(phone, {
                login_token: loginToken,
                token_expiry: tokenExpiry.toISOString(),
                is_logged_in: false
            });
            console.log(`🔄 تحديث: ${phone}`);
        }

        const baseUrl = process.env.API_URL || `http://localhost:${PORT}`;
        const loginUrl = `${baseUrl}/api/auth/verify/${loginToken}`;

        try {
            await bot.sendLoginLink(phone, loginUrl, user.name);

            res.json({
                success: true,
                message: 'تم إرسال الرابط إلى WhatsApp!'
            });
        } catch (botError) {
            await userService.update(phone, {
                login_token: null,
                token_expiry: null
            });

            res.status(500).json({
                success: false,
                error: botError.message
            });
        }

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في الخادم'
        });
    }
});

// ═══════════════════════════════════════
// API: التحقق من رابط تسجيل الدخول
// ═══════════════════════════════════════
app.get('/api/auth/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;

        console.log(`🔑 محاولة التحقق: ${token.substring(0, 8)}...`);

        const user = await userService.findByToken(token);

        if (!user) {
            const redirectUrl = process.env.WEBSITE_URL || 'http://localhost';
            return res.redirect(`${redirectUrl}/login?error=invalid_token`);
        }

        const now = new Date();
        const expiry = new Date(user.token_expiry);

        if (now > expiry) {
            const redirectUrl = process.env.WEBSITE_URL || 'http://localhost';
            return res.redirect(`${redirectUrl}/login?error=expired_token`);
        }

        console.log(`✅ تسجيل دخول ناجح: ${user.phone}`);

        await userService.update(user.phone, {
            is_logged_in: true,
            last_login: new Date().toISOString(),
            login_token: null,
            token_expiry: null
        });

        const redirectUrl = process.env.WEBSITE_URL || 'http://localhost';
        res.redirect(`${redirectUrl}/auth-callback?session=${user.id}&phone=${user.phone}&name=${encodeURIComponent(user.name)}`);

    } catch (error) {
        console.error('❌ خطأ:', error);
        const redirectUrl = process.env.WEBSITE_URL || 'http://localhost';
        res.redirect(`${redirectUrl}/login?error=server_error`);
    }
});

// ═══════════════════════════════════════
// API: حالة البوت
// ═══════════════════════════════════════
app.get('/api/bot/status', (req, res) => {
    const status = bot.getStatus();
    res.json({
        success: true,
        isReady: status.isReady,
        hasQR: !!status.qrCode
    });
});

// ═══════════════════════════════════════
// API: عرض QR Code
// ═══════════════════════════════════════
app.get('/api/bot/qr', (req, res) => {
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
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
        }
        h1 { color: #25D366; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ البوت متصل بالفعل!</h1>
        <p>يمكنك إغلاق هذه الصفحة</p>
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
    </style>
</head>
<body>
    <h2>⏳ جاري إنشاء QR Code...</h2>
</body>
</html>
        `);
    }

    res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>QR Code - WhatsApp</title>
    <style>
        body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h2 { color: #333; margin-bottom: 20px; }
        #qr { margin: 20px 0; }
        .instructions {
            text-align: right;
            margin-top: 20px;
            line-height: 1.8;
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
            2. اذهب إلى الإعدادات<br>
            3. اضغط "الأجهزة المرتبطة"<br>
            4. اضغط "ربط جهاز"<br>
            5. امسح الكود أعلاه
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
            const res = await fetch('/api/bot/status');
            const data = await res.json();
            if (data.isReady) {
                location.reload();
            }
        }, 5000);
    </script>
</body>
</html>
    `);
});

// ═══════════════════════════════════════
// Health Check
// ═══════════════════════════════════════
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// ═══════════════════════════════════════
// تشغيل الخادم
// ═══════════════════════════════════════
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`🚀 API يعمل على المنفذ: ${PORT}`);
    console.log('═══════════════════════════════════════');
    console.log('');
});

process.on('unhandledRejection', (error) => {
    console.error('❌ خطأ:', error);
});