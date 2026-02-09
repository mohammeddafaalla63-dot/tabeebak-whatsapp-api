const { supabase } = require('./supabase');

/**
 * SupabaseStore — stores the WhatsApp session in Supabase
 * so the bot reconnects automatically without a QR code.
 * 
 * Required Supabase table:
 * 
 * CREATE TABLE whatsapp_sessions (
 *   id TEXT PRIMARY KEY,
 *   data TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
class SupabaseStore {
    constructor() {
        this.tableName = 'whatsapp_sessions';
    }

    async save(session) {
        try {
            const sessionData = JSON.stringify(session);

            const { error } = await supabase
                .from(this.tableName)
                .upsert({
                    id: 'whatsapp_session',
                    data: sessionData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (error) {
                console.error('SupabaseStore save error:', error);
                throw error;
            }

            console.log('✅ Session saved to Supabase');
        } catch (error) {
            console.error('❌ Failed to save session:', error.message);
            throw error;
        }
    }

    async extract() {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('data')
                .eq('id', 'whatsapp_session')
                .single();

            if (error || !data) {
                console.log('📭 No existing session found in Supabase');
                return null;
            }

            console.log('✅ Session retrieved from Supabase');
            return JSON.parse(data.data);
        } catch (error) {
            console.error('❌ Failed to extract session:', error.message);
            return null;
        }
    }

    async delete() {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', 'whatsapp_session');

            if (error) {
                console.error('SupabaseStore delete error:', error);
                throw error;
            }

            console.log('🗑️ Session deleted from Supabase');
        } catch (error) {
            console.error('❌ Failed to delete session:', error.message);
            throw error;
        }
    }
}

module.exports = SupabaseStore;