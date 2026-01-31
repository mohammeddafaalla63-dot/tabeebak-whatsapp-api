require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ خطأ: SUPABASE_URL و SUPABASE_KEY مطلوبان');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const userService = {
    async findByPhone(phone) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data;
    },

    async findByToken(token) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('login_token', token)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data;
    },

    async create(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async update(phone, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('phone', phone)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }
};

module.exports = { supabase, userService };