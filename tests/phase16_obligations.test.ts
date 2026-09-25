import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Phase 16: Idempotency and Overdue Obligations', () => {
  let tenantId: string;
  let activeYearId: string;
  let archivedYearId: string;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    // Obtenir le tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .single();
    
    if (!tenant) throw new Error('Tenant not found');
    tenantId = tenant.id;

    // Obtenir l'année active
    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single();
      
    if (!activeYear) throw new Error('Active year not found');
    activeYearId = activeYear.id;

    // Obtenir une classe
    const { data: classRow } = await supabase
      .from('classes')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    
    if (!classRow) throw new Error('Class not found');
    classId = classRow.id;

    // Obtenir un élève inscrit dans cette classe (qui a déjà généré ses obligations via le trigger/seed)
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('student_id')
      .eq('tenant_id', tenantId)
      .eq('school_year_id', activeYearId)
      .eq('class_id', classId)
      .limit(1)
      .single();

    if (!enrollment) throw new Error('Enrollment not found');
    studentId = enrollment.student_id;
  });

  it('devrait garantir l\'idempotence de la génération d\'obligations', async () => {
    // On appelle explicitement la fonction RPC de génération
    const { error } = await supabase.rpc('generate_student_obligations', {
      p_tenant_id: tenantId,
      p_student_id: studentId,
      p_school_year_id: activeYearId
    });

    // La fonction devrait réussir sans erreur, mais NE PAS créer de doublons
    expect(error).toBeNull();

    // Vérifier les doublons
    const { data: obligations } = await supabase
      .from('financial_obligations')
      .select('fee_id, fee_schedule_id')
      .eq('student_id', studentId)
      .eq('school_year_id', activeYearId);

    const uniqueSet = new Set(obligations?.map(o => `${o.fee_id}-${o.fee_schedule_id || 'null'}`));
    expect(uniqueSet.size).toBe(obligations?.length); // Aucun doublon
  });

  it('devrait mettre à jour le statut des obligations en retard', async () => {
    // Exécuter la fonction de mise à jour des retards
    const { error } = await supabase.rpc('update_overdue_obligations');
    expect(error).toBeNull();

    // Vérifier qu'aucune obligation unpaid n'a une due_date dépassée
    const { data: missedOverdue } = await supabase
      .from('financial_obligations')
      .select('id')
      .eq('status', 'unpaid')
      .not('due_date', 'is', null)
      .lt('due_date', new Date().toISOString().split('T')[0]);

    expect(missedOverdue?.length).toBe(0);
  });
});
