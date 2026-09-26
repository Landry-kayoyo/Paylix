'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getDefaultDashboardPath } from '@/lib/user-profile'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  const requestedNext = formData.get('next')

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Identifiants invalides.' }
  }

  // Use admin client to bypass RLS timing issues right after login
  const { data: memberships } = await supabaseAdmin
    .from('user_memberships')
    .select('role')
    .eq('user_id', signInData.user.id)
    .eq('status', 'active')

  const dashboardPath = getDefaultDashboardPath((memberships ?? []) as Array<{ role?: string | null }>)

  revalidatePath('/', 'layout')
  redirect(
    typeof requestedNext === 'string' && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : dashboardPath
  )
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}
