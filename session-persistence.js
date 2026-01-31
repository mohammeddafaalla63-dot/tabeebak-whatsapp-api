/**
 * WhatsApp Session Persistence for Render
 * Saves/loads session data to/from Supabase Storage
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase');

const SESSION_BUCKET = 'whatsapp-sessions';
const SESSION_FILE = 'session-data.zip';
const LOCAL_SESSION_PATH = './.wwebjs_auth';

/**
 * Save session to Supabase Storage
 */
async function saveSession() {
    try {
        console.log('💾 Saving WhatsApp session to Supabase...');

        // Check if session folder exists
        if (!fs.existsSync(LOCAL_SESSION_PATH)) {
            console.log('⚠️ No session folder found, skipping save');
            return { success: false, error: 'No session folder' };
        }

        // Create a simple backup by reading the session folder
        // Note: For production, consider using archiver or tar to compress
        const sessionData = await readSessionFolder(LOCAL_SESSION_PATH);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(SESSION_BUCKET)
            .upload(SESSION_FILE, JSON.stringify(sessionData), {
                contentType: 'application/json',
                upsert: true
            });

        if (error) {
            console.error('❌ Failed to save session:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Session saved successfully');
        return { success: true, data };

    } catch (error) {
        console.error('❌ Session save error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Load session from Supabase Storage
 */
async function loadSession() {
    try {
        console.log('📥 Loading WhatsApp session from Supabase...');

        // Download from Supabase Storage
        const { data, error } = await supabase.storage
            .from(SESSION_BUCKET)
            .download(SESSION_FILE);

        if (error) {
            console.log('⚠️ No saved session found:', error.message);
            return { success: false, error: error.message };
        }

        // Convert blob to text
        const sessionText = await data.text();
        const sessionData = JSON.parse(sessionText);

        // Restore session folder
        await restoreSessionFolder(LOCAL_SESSION_PATH, sessionData);

        console.log('✅ Session loaded successfully');
        return { success: true };

    } catch (error) {
        console.error('❌ Session load error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Read session folder structure
 */
async function readSessionFolder(folderPath) {
    const sessionData = {};

    function readDir(dirPath, relativePath = '') {
        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
            const fullPath = path.join(dirPath, item);
            const relPath = path.join(relativePath, item);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                readDir(fullPath, relPath);
            } else if (stats.isFile()) {
                // Only save important files (not cache)
                if (!relPath.includes('Cache') && !relPath.includes('cache')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'base64');
                        sessionData[relPath] = content;
                    } catch (err) {
                        console.warn(`⚠️ Could not read ${relPath}`);
                    }
                }
            }
        });
    }

    readDir(folderPath);
    return sessionData;
}

/**
 * Restore session folder structure
 */
async function restoreSessionFolder(folderPath, sessionData) {
    // Create base folder
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // Restore files
    for (const [relPath, content] of Object.entries(sessionData)) {
        const fullPath = path.join(folderPath, relPath);
        const dirPath = path.dirname(fullPath);

        // Create directory if needed
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write file
        try {
            fs.writeFileSync(fullPath, Buffer.from(content, 'base64'));
        } catch (err) {
            console.warn(`⚠️ Could not restore ${relPath}`);
        }
    }
}

/**
 * Check if session exists in Supabase
 */
async function sessionExists() {
    try {
        const { data, error } = await supabase.storage
            .from(SESSION_BUCKET)
            .list('', {
                search: SESSION_FILE
            });

        if (error) return false;
        return data && data.length > 0;

    } catch (error) {
        return false;
    }
}

/**
 * Delete session from Supabase
 */
async function deleteSession() {
    try {
        console.log('🗑️ Deleting session from Supabase...');

        const { error } = await supabase.storage
            .from(SESSION_BUCKET)
            .remove([SESSION_FILE]);

        if (error) {
            console.error('❌ Failed to delete session:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Session deleted');
        return { success: true };

    } catch (error) {
        console.error('❌ Session delete error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    saveSession,
    loadSession,
    sessionExists,
    deleteSession
};
