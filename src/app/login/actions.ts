'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Identifiants invalides.' }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  redirect('/login')
}
