import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface AudienceCriteria {
  schoolYearId: string;
  tenantId: string;
  target: 'all' | 'specific_parents' | 'by_class' | 'by_student' | 'financial';
  parentIds?: string[];
  classIds?: string[];
  studentIds?: string[];
  financial?: {
    status: 'overdue' | 'unpaid' | 'partial' | 'prior_debt';
    currency?: 'CDF' | 'USD';
  };
}

export interface AudienceResult {
  recipientIds: string[];
  count: number;
}

export class ParentAudienceService {
  constructor(private supabase: SupabaseClient) {}

  async calculateAudience(criteria: AudienceCriteria): Promise<AudienceResult> {
    const { tenantId, schoolYearId, target } = criteria;
    let recipientIds: Set<string> = new Set();

    if (target === 'all') {
      const { data } = await this.supabase
        .from('parent_students')
        .select('parent_id, parents!inner(user_id)')
        .eq('parents.tenant_id', tenantId)
        .is('ended_at', null);
      
      data?.forEach(d => {
        if (d.parents?.user_id) recipientIds.add(d.parents.user_id);
      });
    } else if (target === 'specific_parents' && criteria.parentIds) {
      const { data } = await this.supabase
        .from('parents')
        .select('user_id')
        .in('id', criteria.parentIds)
        .eq('tenant_id', tenantId);
        
      data?.forEach(d => {
        if (d.user_id) recipientIds.add(d.user_id);
      });
    } else if (target === 'by_class' && criteria.classIds) {
      // Find students in those classes for the current school year
      const { data: students } = await this.supabase
        .from('class_students')
        .select('student_id')
        .in('class_id', criteria.classIds)
        .eq('school_year_id', schoolYearId)
        .is('ended_at', null);
        
      if (students && students.length > 0) {
        const studentIds = students.map(s => s.student_id);
        const { data: parents } = await this.supabase
          .from('parent_students')
          .select('parents!inner(user_id)')
          .in('student_id', studentIds)
          .is('ended_at', null);
          
        parents?.forEach(d => {
          if (d.parents?.user_id) recipientIds.add(d.parents.user_id);
        });
      }
    } else if (target === 'by_student' && criteria.studentIds) {
      const { data: parents } = await this.supabase
        .from('parent_students')
        .select('parents!inner(user_id)')
        .in('student_id', criteria.studentIds)
        .is('ended_at', null);
        
      parents?.forEach(d => {
        if (d.parents?.user_id) recipientIds.add(d.parents.user_id);
      });
    } else if (target === 'financial' && criteria.financial) {
      // Complex logic for financial targeting based on obligations
      // This is a simplified version for demonstration
      const { status, currency } = criteria.financial;
      
      let query = this.supabase
        .from('financial_obligations')
        .select('student_id')
        .eq('tenant_id', tenantId)
        .eq('school_year_id', schoolYearId);
        
      if (currency) {
        query = query.eq('currency', currency);
      }
      
      if (status === 'unpaid') {
        query = query.eq('paid_amount', 0);
      } else if (status === 'partial') {
        query = query.gt('paid_amount', 0).raw('paid_amount < amount');
      } else if (status === 'overdue') {
        query = query.lt('due_date', new Date().toISOString()).raw('paid_amount < amount');
      }

      const { data: obligations } = await query;
      
      if (obligations && obligations.length > 0) {
        const studentIds = obligations.map(o => o.student_id);
        const { data: parents } = await this.supabase
          .from('parent_students')
          .select('parents!inner(user_id)')
          .in('student_id', studentIds)
          .is('ended_at', null);
          
        parents?.forEach(d => {
          if (d.parents?.user_id) recipientIds.add(d.parents.user_id);
        });
      }
    }

    const finalRecipients = Array.from(recipientIds);
    return {
      recipientIds: finalRecipients,
      count: finalRecipients.length
    };
  }
}
