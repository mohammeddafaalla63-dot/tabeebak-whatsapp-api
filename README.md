# Tabeebak WhatsApp API

WhatsApp Web.js integration for Tabeebak platform - handles magic link authentication and automated notifications.

## Features

- 🔐 **Magic Link Authentication**: Passwordless login via WhatsApp
- 📱 **Automated Notifications**: Booking confirmations, payment updates, doctor ready alerts
- 🔄 **Auto-Reconnect**: Automatic reconnection on disconnection
- ⏱️ **Rate Limiting**: 3 login requests per hour per phone number
- 📊 **Message Queue**: Handles high volume with queue system
- 💓 **Keep-Alive**: Prevents Render free tier from sleeping

## Setup

### 1. Install Dependencies

```bash
cd whatsapp-api
npm install
```

### 2. Configure Environment

Edit `.env` file:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Server
PORT=3000
NODE_ENV=development

# WhatsApp
COUNTRY_CODE=249

# URLs
API_URL=http://localhost:3000
WEBSITE_URL=http://localhost:3001
```

### 3. Start the Server

```bash
npm start
```

### 4. Scan QR Code

1. Open browser: `http://localhost:3000/api/bot/qr`
2. Scan QR code with WhatsApp
3. Wait for "البوت متصل بنجاح!" message

## API Endpoints

### Authentication

#### POST `/api/auth/request-login`
Request magic link for login

**Request:**
```json
{
  "phone": "249127125228"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login link sent to WhatsApp!",
  "expiresIn": "15 minutes",
  "remaining": 2
}
```

#### GET `/api/auth/verify/:token`
Verify magic link token (redirects to website)

### Notifications

#### POST `/api/notifications/booking-confirmed`
Send booking confirmation

**Request:**
```json
{
  "phone": "249127125228",
  "doctorName": "Dr. Ahmed",
  "bookingId": "BK123456"
}
```

#### POST `/api/notifications/payment-received`
Confirm payment receipt received

**Request:**
```json
{
  "phone": "249127125228"
}
```

#### POST `/api/notifications/payment-verified`
Notify payment verification

**Request:**
```json
{
  "phone": "249127125228",
  "doctorName": "Dr. Ahmed"
}
```

#### POST `/api/notifications/doctor-ready`
Notify patient doctor is ready

**Request:**
```json
{
  "phone": "249127125228",
  "doctorName": "Dr. Ahmed",
  "meetLink": "https://meet.google.com/abc-defg-hij"
}
```

### Bot Management

#### GET `/api/bot/status`
Get bot connection status

**Response:**
```json
{
  "success": true,
  "isReady": true,
  "hasQR": false,
  "queueLength": 0,
  "info": {
    "pushname": "Tabeebak Bot",
    "wid": "..."
  }
}
```

#### GET `/api/bot/qr`
Display QR code for WhatsApp setup (HTML page)

#### GET `/api/bot/info`
Get detailed bot information

### Health Check

#### GET `/health`
Server health check

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T...",
  "whatsapp": {
    "connected": true
  }
}
```

## Phone Number Format

All phone numbers should be in Sudan format:

- **With country code**: `249127125228`
- **Without country code**: `0127125228` (auto-converted to `249127125228`)
- **International format**: `+249127125228` (cleaned to `249127125228`)

## Rate Limiting

- **Login requests**: 3 per hour per phone number
- **Message queue**: 2 seconds delay between messages
- **Auto-cleanup**: Old rate limit entries removed hourly

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WhatsApp service is temporarily unavailable` | Bot not connected | Wait for bot to connect or scan QR code |
| `Phone number is not registered on WhatsApp` | Invalid WhatsApp number | Verify phone number is active on WhatsApp |
| `Too many requests` | Rate limit exceeded | Wait for rate limit reset (shown in error) |
| `Invalid or expired link` | Token expired or used | Request new magic link |

## Deployment

### Render (Free Tier)

1. Create new Web Service on Render
2. Connect GitHub repository
3. Set build command: `cd whatsapp-api && npm install`
4. Set start command: `cd whatsapp-api && npm start`
5. Add environment variables from `.env`
6. Deploy

**Important**: After deployment, visit `/api/bot/qr` to scan QR code and connect WhatsApp.

### Keep-Alive

The server includes automatic keep-alive pings every 10 minutes to prevent Render free tier from sleeping.

## File Structure

```
whatsapp-api/
├── bot.js              # WhatsApp bot class
├── server.js           # Express API server (current)
├── server-enhanced.js  # Enhanced server (recommended)
├── supabase.js         # Supabase client
├── package.json        # Dependencies
├── .env                # Environment variables
├── .wwebjs_auth/       # WhatsApp session data
└── .wwebjs_cache/      # WhatsApp cache
```

## Troubleshooting

### Bot Won't Connect

1. Delete `.wwebjs_auth` folder
2. Restart server
3. Scan QR code again

### Messages Not Sending

1. Check bot status: `GET /api/bot/status`
2. Verify phone number format
3. Check rate limits
4. Review server logs

### Session Lost

WhatsApp sessions can expire. If this happens:

1. Visit `/api/bot/qr`
2. Scan QR code again
3. Session will be restored

## Security Notes

- Never commit `.env` file
- Use environment variables for sensitive data
- Implement proper authentication for production
- Use HTTPS in production
- Consider Redis for rate limiting in production

## Support

For issues or questions, contact the Tabeebak development team.
