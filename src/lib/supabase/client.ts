import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

function getBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

/**
 * Defer client creation until a Supabase property is accessed. This lets pages
 * that create the client during render be statically prerendered without
 * constructing a client at build time. Actual auth/database calls still need
 * the public Supabase environment variables configured in the deployment.
 */
export function createClient(): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, property) {
      const client = getBrowserClient()
      const value = Reflect.get(client, property, client)
      return typeof value === 'function' ? value.bind(client) : value
    },
  })
}
