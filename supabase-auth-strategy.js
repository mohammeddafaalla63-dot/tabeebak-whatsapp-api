/**
 * Supabase Remote Auth Strategy for WhatsApp Web.js
 * Stores session data in Supabase to persist across Render restarts
 */

const { supabase } = require('./supabase');

class SupabaseAuthStrategy {
    constructor(options = {}) {
        this.clientId = options.clientId || 'whatsapp-session';
        this.tableName = 'whatsapp_sessions';
    }

    async beforeBrowserInitialized() {
        console.log('🔐 SupabaseAuthStrategy: Initializing...');

        // Try to load existing session
        const sessionData = await this.getSessionData();

        if (sessionData) {
            console.log('✅ Found existing session in Supabase');
            return sessionData;
        } else {
            console.log('⚠️ No existing session found');
            return null;
        }
    }

    async afterBrowserInitialized() {
        console.log('🔐 SupabaseAuthStrategy: Browser initialized');
    }

    async onAuthenticationNeeded() {
        console.log('🔐 SupabaseAuthStrategy: Authentication needed');
        return {
            failed: false,
            restart: false,
            failureEventPayload: undefined
        };
    }

    async saveSession(sessionData) {
        try {
            console.log('💾 Saving session to Supabase...');

            // Convert session data to string
            const sessionString = JSON.stringify(sessionData);

            // Upsert to Supabase
            const { data, error } = await supabase
                .from(this.tableName)
                .upsert({
                    client_id: this.clientId,
                    session_data: sessionString,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'client_id'
                })
                .select();

            if (error) {
                console.error('❌ Failed to save session:', error);
                return false;
            }

            console.log('✅ Session saved successfully');
            return true;

        } catch (error) {
            console.error('❌ Session save error:', error);
            return false;
        }
    }

    async getSessionData() {
        try {
            console.log('📥 Loading session from Supabase...');

            const { data, error } = await supabase
                .from(this.tableName)
                .select('session_data')
                .eq('client_id', this.clientId)
                .single();

            if (error || !data) {
                console.log('⚠️ No session found in Supabase');
                return null;
            }

            console.log('✅ Session loaded from Supabase');
            return JSON.parse(data.session_data);

        } catch (error) {
            console.error('❌ Session load error:', error);
            return null;
        }
    }

    async deleteSession() {
        try {
            console.log('🗑️ Deleting session from Supabase...');

            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('client_id', this.clientId);

            if (error) {
                console.error('❌ Failed to delete session:', error);
                return false;
            }

            console.log('✅ Session deleted');
            return true;

        } catch (error) {
            console.error('❌ Session delete error:', error);
            return false;
        }
    }

    async logout() {
        console.log('👋 SupabaseAuthStrategy: Logging out...');
        await this.deleteSession();
    }
}

module.exports = SupabaseAuthStrategy;
