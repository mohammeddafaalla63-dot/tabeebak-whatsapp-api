-- Create WhatsApp Sessions Table in Supabase
-- This stores WhatsApp session data to persist across Render restarts

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    session_data JSONB NOT NULL,
    phone_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id 
ON whatsapp_sessions(session_id);

-- Create index for active sessions
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_is_active 
ON whatsapp_sessions(is_active);

-- Add RLS (Row Level Security) policies
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage sessions"
ON whatsapp_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow anon to read active sessions (for status checks)
CREATE POLICY "Anon can read active sessions"
ON whatsapp_sessions
FOR SELECT
TO anon
USING (is_active = true);

-- Add comment
COMMENT ON TABLE whatsapp_sessions IS 'Stores WhatsApp Web.js session data for persistence across container restarts';
