import { createClient } from '@supabase/supabase-js'

// Create a single supabase admin client for interacting with your database
// This client bypasses RLS and should ONLY be used in secure server environments
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
