import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next')
  const next = requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/update-password'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectUrl = new URL(next, requestUrl.origin)

      if (data.session) {
        redirectUrl.hash = new URLSearchParams({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          type: redirectUrl.pathname === "/update-password" ? "recovery" : "magiclink",
        }).toString()
      }

      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there's an error or no code, fallback to update-password or login
  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
