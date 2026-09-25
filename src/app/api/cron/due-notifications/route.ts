import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Find obligations due in 3 days (approaching) or overdue (due_date < today and not paid)
    const { data: obligations, error } = await supabase
      .from('financial_obligations')
      .select('id, tenant_id, student_id, remaining_amount, due_date, status, fees(name), students(first_name, last_name, parent_students(parent_id, parents(user_id)))')
      .in('status', ['unpaid', 'partial', 'overdue'])
      .not('due_date', 'is', null);

    if (error) throw error;

    const typedObligations = (obligations || []) as any[];
    let processedCount = 0;
    const now = new Date();

    for (const obs of typedObligations) {
      if (!obs.due_date || !obs.students?.parent_students) continue;

      const dueDate = new Date(obs.due_date);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let notifType = '';
      let title = '';
      let message = '';
      const feeName = Array.isArray(obs.fees) ? obs.fees[0]?.name : (obs.fees as any)?.name;

      if (obs.status === 'overdue') {
        notifType = 'PAYMENT_OVERDUE';
        title = 'Paiement en retard';
        message = `Les frais "${feeName}" de ${obs.students.first_name} sont en retard. Le montant restant à payer est de ${obs.remaining_amount}.`;
      } else if (diffDays === 3) {
        notifType = 'DUE_DATE_APPROACHING';
        title = 'Échéance de paiement proche';
        message = `Les frais "${feeName}" de ${obs.students.first_name} arrivent à échéance le ${dueDate.toLocaleDateString('fr-FR')}. Le montant restant à payer est de ${obs.remaining_amount}.`;
      }

      if (!notifType) continue;

      // Note: For true idempotency without email_queue, we should check if a notification of this type/ref exists
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('reference_id', obs.id)
        .eq('type', notifType)
        .limit(1);

      if (existing && existing.length > 0) continue;

      for (const ps of obs.students.parent_students) {
        const parent = (ps as any).parents;
        if (!parent || !parent.user_id) continue;

        await createNotification({
          tenantId: obs.tenant_id,
          userId: parent.user_id,
          type: notifType,
          title,
          message,
          referenceType: 'financial_obligation',
          referenceId: obs.id,
          context: { student_name: `${obs.students.first_name} ${obs.students.last_name}`, student_id: obs.student_id }
        });
        processedCount++;
      }
    }

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (error: any) {
    console.error('Error processing due notifications:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
