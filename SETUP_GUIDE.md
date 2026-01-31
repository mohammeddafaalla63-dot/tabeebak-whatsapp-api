# 🚀 Tabeebak WhatsApp API - Complete Setup Guide

## Quick Start (Windows)

### Option 1: Double-Click Start (Easiest)

1. Navigate to `whatsapp-api` folder
2. Double-click `START_WHATSAPP_API.bat`
3. Wait for server to start
4. Open browser: `http://localhost:3000/api/bot/qr`
5. Scan QR code with WhatsApp
6. Done! ✅

### Option 2: Command Line

```bash
cd whatsapp-api
npm install
npm start
```

Then visit `http://localhost:3000/api/bot/qr` to scan QR code.

## Detailed Setup

### Step 1: Prerequisites

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **WhatsApp** account with active phone number
- **Supabase** account - [Sign up](https://supabase.com/)

### Step 2: Install Dependencies

```bash
cd whatsapp-api
npm install
```

This will install:
- `whatsapp-web.js` - WhatsApp Web API
- `express` - Web server
- `@supabase/supabase-js` - Database client
- `qrcode-terminal` - QR code display
- `uuid` - Token generation
- `cors` - Cross-origin requests
- `dotenv` - Environment variables

### Step 3: Configure Environment

Edit `.env` file with your credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration
COUNTRY_CODE=249

# URLs
API_URL=http://localhost:3000
WEBSITE_URL=http://localhost:3001

# Keep-Alive (for production)
KEEP_ALIVE_INTERVAL=600000
```

**Where to find Supabase credentials:**

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy:
   - **URL**: Project URL
   - **anon/public key**: anon key

### Step 4: Database Setup

Create the `magic_links` table in Supabase:

```sql
CREATE TABLE magic_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_magic_links_token ON magic_links(token);
CREATE INDEX idx_magic_links_phone ON magic_links(phone_number);
CREATE INDEX idx_magic_links_expires ON magic_links(expires_at);
```

### Step 5: Start the Server

```bash
npm start
```

You should see:

```
🚀 Starting Tabeebak WhatsApp API Server...
📱 Country Code: 249
🌐 Website URL: http://localhost:3001

═══════════════════════════════════════
🚀 Tabeebak WhatsApp API running on port: 3000
🌐 Access at: http://localhost:3000
═══════════════════════════════════════

📱 QR Code generated! Scan with WhatsApp:
```

### Step 6: Connect WhatsApp

1. Open browser: `http://localhost:3000/api/bot/qr`
2. You'll see a QR code
3. Open WhatsApp on your phone
4. Go to Settings → Linked Devices
5. Tap "Link a Device"
6. Scan the QR code
7. Wait for "البوت متصل بنجاح!" message

**Important**: Keep the server running! If you close it, WhatsApp will disconnect.

## Testing the API

### Test 1: Check Server Status

```bash
curl http://localhost:3000/
```

Expected response:
```json
{
  "status": "online",
  "service": "Tabeebak WhatsApp API",
  "whatsapp": {
    "connected": true
  }
}
```

### Test 2: Check Bot Status

```bash
curl http://localhost:3000/api/bot/status
```

Expected response:
```json
{
  "success": true,
  "isReady": true,
  "hasQR": false,
  "queueLength": 0
}
```

### Test 3: Request Magic Link

```bash
curl -X POST http://localhost:3000/api/auth/request-login \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"249127125228\"}"
```

Expected response:
```json
{
  "success": true,
  "message": "Login link sent to WhatsApp!",
  "expiresIn": "15 minutes",
  "remaining": 2
}
```

Check your WhatsApp - you should receive a message with the magic link!

### Test 4: Send Booking Confirmation

```bash
curl -X POST http://localhost:3000/api/notifications/booking-confirmed \
  -H "Content-Type: application/json" \
  -d "{\"phone\": \"249127125228\", \"doctorName\": \"Dr. Ahmed\", \"bookingId\": \"BK123\"}"
```

## Integration with Next.js Frontend

### Update Frontend Login Page

In your Next.js app (`app/auth/login/page.tsx`), update the API URL:

```typescript
const API_URL = 'http://localhost:3000' // Development
// const API_URL = 'https://your-api.onrender.com' // Production

const response = await fetch(`${API_URL}/api/auth/request-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: phoneValue })
})
```

### Create Notification Helper

Create `lib/whatsapp-notifications.ts`:

```typescript
const WHATSAPP_API = process.env.NEXT_PUBLIC_WHATSAPP_API_URL || 'http://localhost:3000'

export async function sendBookingConfirmation(
  phone: string,
  doctorName: string,
  bookingId: string
) {
  const response = await fetch(`${WHATSAPP_API}/api/notifications/booking-confirmed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, doctorName, bookingId })
  })
  return response.json()
}

export async function sendPaymentReceived(phone: string) {
  const response = await fetch(`${WHATSAPP_API}/api/notifications/payment-received`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  })
  return response.json()
}

export async function sendPaymentVerified(phone: string, doctorName: string) {
  const response = await fetch(`${WHATSAPP_API}/api/notifications/payment-verified`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, doctorName })
  })
  return response.json()
}

export async function sendDoctorReady(
  phone: string,
  doctorName: string,
  meetLink: string
) {
  const response = await fetch(`${WHATSAPP_API}/api/notifications/doctor-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, doctorName, meetLink })
  })
  return response.json()
}
```

## Production Deployment (Render)

### Step 1: Prepare for Deployment

1. Commit all changes to Git
2. Push to GitHub
3. Make sure `.env` is in `.gitignore`

### Step 2: Create Render Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `tabeebak-whatsapp-api`
   - **Root Directory**: `whatsapp-api`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 3: Add Environment Variables

In Render dashboard, add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
PORT=3000
NODE_ENV=production
COUNTRY_CODE=249
API_URL=https://tabeebak-whatsapp-api.onrender.com
WEBSITE_URL=https://tabeebak.vercel.app
KEEP_ALIVE_INTERVAL=600000
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Once deployed, visit: `https://your-service.onrender.com/api/bot/qr`
4. Scan QR code to connect WhatsApp

**Important**: Render free tier sleeps after 15 minutes of inactivity. The keep-alive feature will ping the server every 10 minutes to prevent this.

### Step 5: Update Frontend

Update your Next.js `.env.local`:

```env
NEXT_PUBLIC_WHATSAPP_API_URL=https://tabeebak-whatsapp-api.onrender.com
```

## Troubleshooting

### Problem: QR Code Not Showing

**Solution:**
1. Check if server is running: `http://localhost:3000/health`
2. Restart server
3. Clear browser cache
4. Try different browser

### Problem: "WhatsApp service is temporarily unavailable"

**Solution:**
1. Check bot status: `http://localhost:3000/api/bot/status`
2. If `isReady: false`, visit `/api/bot/qr` and scan QR code
3. Wait 30 seconds for connection

### Problem: "Phone number is not registered on WhatsApp"

**Solution:**
1. Verify phone number format: `249127125228`
2. Make sure number is active on WhatsApp
3. Try with country code: `+249127125228`

### Problem: Session Lost / Disconnected

**Solution:**
1. Delete `.wwebjs_auth` folder
2. Restart server
3. Scan QR code again

### Problem: Rate Limit Exceeded

**Solution:**
- Wait 1 hour for rate limit reset
- Or clear rate limit manually (restart server)

### Problem: Messages Not Sending

**Solution:**
1. Check bot status
2. Verify phone number format
3. Check server logs for errors
4. Test with your own number first

## Maintenance

### Backup WhatsApp Session

The `.wwebjs_auth` folder contains your WhatsApp session. Back it up to avoid re-scanning QR code:

```bash
# Backup
cp -r .wwebjs_auth .wwebjs_auth_backup

# Restore
cp -r .wwebjs_auth_backup .wwebjs_auth
```

### Monitor Server Health

Create a monitoring script:

```bash
# check-health.bat
@echo off
curl http://localhost:3000/health
pause
```

### View Logs

Server logs show all activity:
- Login requests
- Message sending
- Errors
- Connection status

## Security Best Practices

1. **Never commit `.env` file**
2. **Use HTTPS in production**
3. **Implement API authentication** (add API keys)
4. **Rate limit all endpoints**
5. **Validate phone numbers**
6. **Log all activities**
7. **Monitor for abuse**

## Support

For issues or questions:
- Check logs first
- Review this guide
- Contact Tabeebak development team

## Next Steps

1. ✅ Setup complete
2. Test all endpoints
3. Integrate with frontend
4. Deploy to production
5. Monitor and maintain

Happy coding! 🚀
