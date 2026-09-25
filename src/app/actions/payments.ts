'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const RecordPaymentSchema = z.object({
  tenant_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  student_id: z.string().uuid(),
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  currency: z.enum(['CDF', 'USD']),
  allocations: z.array(z.object({
    obligation_id: z.string().uuid(),
    amount: z.number().positive(),
  })).min(1, "Au moins une affectation est requise"),
})

const RecordPaymentGroupSchema = z.object({
  tenant_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  student_id: z.string().uuid(),
  groups: z.array(z.object({
    currency: z.enum(['CDF', 'USD']),
    amount: z.number().positive(),
    allocations: z.array(z.object({
      obligation_id: z.string().uuid(),
      amount: z.number().positive(),
    })).min(1),
  })).min(1),
})

export async function recordPayment(data: z.infer<typeof RecordPaymentSchema>) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

  // Seul le comptable peut créer un paiement.
  const { data: membership } = await supabase
    .from('user_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', data.tenant_id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'accountant') {
    return { error: 'Seul un comptable peut enregistrer un paiement.' }
  }

  // Vérifier que la somme des allocations correspond au montant total
  const totalAllocated = data.allocations.reduce((sum, alloc) => sum + alloc.amount, 0)
  if (totalAllocated !== data.amount) {
    return { error: 'La somme des allocations ne correspond pas au montant total.' }
  }

  // Appeler la fonction RPC pour enregistrer le paiement de manière atomique
  const { data: paymentId, error } = await supabase.rpc('record_payment', {
    p_tenant_id: data.tenant_id,
    p_school_year_id: data.school_year_id,
    p_student_id: data.student_id,
    p_amount: data.amount,
    p_currency: data.currency,
    p_recorded_by: user.id,
    p_allocations: data.allocations
  })

  if (error) {
    console.error('Erreur lors de l\'enregistrement du paiement:', error)
    return { error: error.message }
  }

  revalidatePath(`/[tenantId]/accountant/payments`, 'page')
  return { success: true, paymentId }
}

export async function recordPaymentGroup(data: z.infer<typeof RecordPaymentGroupSchema>) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', data.tenant_id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'accountant') {
    return { error: 'Seul un comptable peut enregistrer un paiement.' }
  }

  for (const group of data.groups) {
    const totalAllocated = group.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    if (totalAllocated !== group.amount) {
      return { error: `La somme des allocations ${group.currency} ne correspond pas au montant du paiement.` }
    }
  }

  const { data: paymentId, error } = await supabase.rpc('record_payment_group', {
    p_tenant_id: data.tenant_id,
    p_school_year_id: data.school_year_id,
    p_student_id: data.student_id,
    p_recorded_by: user.id,
    p_groups: data.groups,
  })

  if (error) {
    console.error('Erreur lors de l\'enregistrement du groupe de paiements:', error)
    return { error: error.message }
  }

  revalidatePath(`/[tenantId]/accountant/payments`, 'page')
  return { success: true, paymentId }
}


const CancelPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  cancellation_reason: z.string().min(3, "Le motif d'annulation est requis"),
})

export async function cancelPayment(data: z.infer<typeof CancelPaymentSchema>) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', data.tenant_id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'accountant') {
    return { error: 'Seul un comptable peut annuler un paiement.' }
  }

  const { error } = await supabase.rpc('cancel_payment', {
    p_payment_id: data.payment_id,
    p_tenant_id: data.tenant_id,
    p_cancellation_reason: data.cancellation_reason,
    p_cancelled_by: user.id
  })

  if (error) {
    console.error('Erreur lors de l\'annulation du paiement:', error)
    return { error: error.message }
  }

  revalidatePath(`/[tenantId]/accountant/payments`, 'page')
  revalidatePath(`/[tenantId]/accountant/payments/${data.payment_id}`, 'page')
  
  return { success: true }
}
