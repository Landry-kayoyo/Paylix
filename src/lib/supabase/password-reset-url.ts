export function buildRecoveryRedirectUrl(origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000') {
  const callbackUrl = new URL('/auth/callback', origin)
  callbackUrl.searchParams.set('next', '/update-password?type=recovery')
  return callbackUrl.toString()
}
