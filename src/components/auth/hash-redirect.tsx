'use client'

import { useEffect } from 'react'

export function HashRedirect() {
  useEffect(() => {
    // useEffect runs after hydration - catch any remaining hash tokens
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.substring(1))
    const hasToken = params.has('access_token')
    const tokenType = params.get('type')

    if (window.location.pathname !== '/update-password' && hasToken && (tokenType === 'invite' || tokenType === 'recovery')) {
      window.location.replace('/update-password' + hash)
    }
  }, [])

  return null
}
