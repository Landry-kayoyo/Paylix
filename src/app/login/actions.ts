'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDefaultDashboardPath } from '@/lib/user-profile'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  const requestedNext = formData.get('next')
  const next = typeof requestedNext === 'string' && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/'

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Identifiants invalides.' }
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('user_memberships')
    .select('role')
    .eq('user_id', signInData.user.id)
    .eq('status', 'active')

  const dashboardPath = membershipsError ? '/' : getDefaultDashboardPath((memberships ?? []) as Array<{ role?: string | null }>)

  revalidatePath('/', 'layout')
  redirect(requestedNext && typeof requestedNext === 'string' && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : dashboardPath)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}
