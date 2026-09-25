import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { pickPrimaryMembership } from '@/lib/user-profile'

type AppRole = 'platform_admin' | 'director' | 'accountant' | 'parent'

// Map: route prefix → authorized roles
const ROUTE_ROLE_MAP: Record<string, AppRole[]> = {
  '/platform': ['platform_admin'],
  '/school': ['director'],
  '/accountant': ['accountant'],
  '/parent': ['parent'],
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token — DO NOT remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/forgot-password')
  // /parent/join is intentionally public — unauthenticated users can view the
  // invitation details and are prompted to log in before accepting/declining.
  const isPublicParentRoute = pathname.startsWith('/parent/join')
  // '/' is the public landing page — no auth required.
  const isPublicLanding = pathname === '/'
  const isProtectedRoute =
    !isPublicParentRoute &&
    !isPublicLanding && (
      pathname.startsWith('/platform') ||
      pathname.startsWith('/school') ||
      pathname.startsWith('/accountant') ||
      pathname.startsWith('/parent') ||
      pathname.startsWith('/account')
    )

  // Redirect to login if unauthenticated and accessing a protected route
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If authenticated and accessing login, redirect to root (which will route by role)
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Check must_change_password for ALL protected routes including '/'
  if (user && isProtectedRoute) {
    if (pathname.startsWith('/update-password')) {
      // Allow access to update password
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.must_change_password) {
        const url = request.nextUrl.clone()
        url.pathname = '/update-password'
        return NextResponse.redirect(url)
      }
    }
  }

  // Role-based access control for protected spaces
  if (user && isProtectedRoute && pathname !== '/') {
    const { data: memberships } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const membership = pickPrimaryMembership((memberships ?? []) as Array<{ role?: string | null }>)
    const userRole = membership?.role as AppRole | null

    // Find which route space this request targets
    const targetedSpace = Object.keys(ROUTE_ROLE_MAP).find(prefix =>
      pathname.startsWith(prefix)
    )

    if (targetedSpace && userRole) {
      const allowedRoles = ROUTE_ROLE_MAP[targetedSpace]
      if (!allowedRoles.includes(userRole)) {
        // Forbidden: redirect to their correct dashboard
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
