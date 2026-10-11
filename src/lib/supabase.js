import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY // Hoặc REACT_APP_SUPABASE_ANON_KEY nếu file .env của bạn dùng tên đó

if (!supabaseUrl || !supabaseKey) {
  console.error("Thiếu biến môi trường Supabase! Hãy kiểm tra file .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey)