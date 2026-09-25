'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CreateStudentSchema = z.object({
  tenant_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  post_name: z.string().optional().nullable(),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  school_year_id: z.string().uuid(),
  class_id: z.string().uuid(),
})

export async function createStudent(data: z.infer<typeof CreateStudentSchema>) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', data.tenant_id)
    .eq('status', 'active')
    .single()

  if (!membership || (membership.role !== 'director' && membership.role !== 'platform_admin')) {
    return { error: 'Forbidden' }
  }

  const enrollmentYear = new Date().getFullYear().toString()
  const yearPrefix = enrollmentYear.substring(2)

  const { data: studentId, error } = await supabase.rpc('create_student_with_enrollment', {
    p_tenant_id: data.tenant_id,
    p_first_name: data.first_name,
    p_last_name: data.last_name,
    p_post_name: data.post_name || null,
    p_date_of_birth: data.date_of_birth,
    p_gender: data.gender,
    p_school_year_id: data.school_year_id,
    p_class_id: data.class_id,
    p_year_prefix: yearPrefix
  })

  if (error) {
    console.error('Error creating student:', error)
    return { error: error.message }
  }

  return { success: true, studentId }
}

const UpdateStudentSchema = z.object({
  student_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  post_name: z.string().optional().nullable(),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
})

export async function updateStudent(data: z.infer<typeof UpdateStudentSchema>) {
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

  if (!membership || (membership.role !== 'director' && membership.role !== 'platform_admin')) {
    return { error: 'Forbidden' }
  }

  const { error } = await supabase
    .from('students')
    .update({
      first_name: data.first_name,
      last_name: data.last_name,
      post_name: data.post_name,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
    })
    .eq('id', data.student_id)
    .eq('tenant_id', data.tenant_id)

  if (error) {
    console.error('Error updating student:', error)
    return { error: error.message }
  }

  return { success: true }
}

const EnrollStudentSchema = z.object({
  student_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
  class_id: z.string().uuid(),
})

export async function enrollStudent(data: z.infer<typeof EnrollStudentSchema>) {
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

  if (!membership || (membership.role !== 'director' && membership.role !== 'platform_admin')) {
    return { error: 'Forbidden' }
  }

  const { error } = await supabase
    .from('student_enrollments')
    .insert({
      tenant_id: data.tenant_id,
      student_id: data.student_id,
      school_year_id: data.school_year_id,
      class_id: data.class_id,
    })

  if (error) {
    if (error.code === '23505') { 
      return { error: 'This student is already enrolled for this school year.' }
    }
    return { error: error.message }
  }

  return { success: true }
}

const ChangeClassSchema = z.object({
  enrollment_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  old_class_id: z.string().uuid(),
  new_class_id: z.string().uuid(),
})

export async function changeStudentClass(data: z.infer<typeof ChangeClassSchema>) {
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

  if (!membership || (membership.role !== 'director' && membership.role !== 'platform_admin')) {
    return { error: 'Forbidden' }
  }

  // Update enrollment
  const { error: updateError } = await supabase
    .from('student_enrollments')
    .update({ class_id: data.new_class_id })
    .eq('id', data.enrollment_id)
    .eq('tenant_id', data.tenant_id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Record history
  await supabase
    .from('enrollment_history')
    .insert({
      tenant_id: data.tenant_id,
      enrollment_id: data.enrollment_id,
      old_class_id: data.old_class_id,
      new_class_id: data.new_class_id,
      changed_by: user.id
    })

  return { success: true }
}

const ArchiveStudentSchema = z.object({
  student_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
})

export async function archiveStudent(data: z.infer<typeof ArchiveStudentSchema>) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('students')
    .update({ status: 'archived' })
    .eq('id', data.student_id)
    .eq('tenant_id', data.tenant_id)

  if (error) return { error: error.message }
  return { success: true }
}
