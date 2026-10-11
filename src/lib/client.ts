import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY // Hoặc ANON_KEY tùy vào file .env của bạn

if (!supabaseUrl || !supabaseKey) {
  console.error("Thiếu biến môi trường Supabase!");
}

export const supabase = createClient(supabaseUrl as string, supabaseKey as string)