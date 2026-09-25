import { describe, expect, it } from 'vitest'
import { buildRecoveryRedirectUrl } from '../src/lib/supabase/password-reset-url'

describe('buildRecoveryRedirectUrl', () => {
  it('sends the Supabase recovery link back to the update-password route with a recovery type parameter', () => {
    expect(buildRecoveryRedirectUrl('https://paylix.example.com')).toBe(
      'https://paylix.example.com/update-password?type=recovery'
    )
  })
})
