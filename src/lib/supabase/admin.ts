import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Keep the service-role client lazy: importing a Server Action during Next.js
// build/page-data collection must not require production secrets to exist.
let adminClient: SupabaseClient | undefined

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at runtime.'
    )
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}

// Proxy preserves the existing `supabaseAdmin.from(...)`, `.auth`, and
// `.storage` call sites while deferring client creation until first use.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = getAdminClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
