import { createClient } from '@/lib/supabase/server';

export interface NotificationPayload {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  context?: any;
}

export async function createNotification(payload: NotificationPayload) {
  const supabase = await createClient();

  const { error } = await supabase.from('notifications').insert({
    tenant_id: payload.tenantId,
    user_id: payload.userId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    reference_type: payload.referenceType || null,
    reference_id: payload.referenceId || null,
    context: payload.context || null,
  });

  if (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) {
    console.error('Failed to mark notification as read:', error);
  }
}
