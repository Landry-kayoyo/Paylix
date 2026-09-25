import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const profilesEq = vi.fn()
const membershipsEq = vi.fn()
const parentsEq = vi.fn()

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: 'user-123' } }, error: null })),
  },
  from: vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        update: vi.fn(() => ({ eq: profilesEq })),
      }
    }

    if (table === 'user_memberships') {
      return {
        update: vi.fn(() => ({ eq: membershipsEq })),
      }
    }

    if (table === 'parents') {
      return {
        update: vi.fn(() => ({ eq: parentsEq })),
      }
    }

    throw new Error(`Unexpected table ${table}`)
  }),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

describe('confirmPasswordChange regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    profilesEq.mockResolvedValue({ error: null })
    membershipsEq.mockResolvedValue({ error: null })
    parentsEq.mockResolvedValue({ error: null })
  })

  it('updates parent account_status and activated_at when a parent activates a password', async () => {
    const { confirmPasswordChange } = await import('../src/app/actions/auth')

    await confirmPasswordChange()

    expect(mockSupabase.from).toHaveBeenCalledWith('parents')
    expect(parentsEq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})
