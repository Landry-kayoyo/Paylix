"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getNotifications(limit = 10) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], unreadCount: 0 };

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications', error);
    return { data: [], unreadCount: 0 };
  }

  const { count, error: countError } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return {
    data: notifications || [],
    unreadCount: count || 0
  };
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) {
    console.error('Error marking notification as read', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function getNotificationById(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null };

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching notification by id', error);
    return { data: null };
  }

  // Mark as read when fetched directly for detail view
  if (!data.read_at) {
    await markAsRead(id);
    data.read_at = new Date().toISOString(); // update local object
  }

  return { data };
}

export async function getReceiptByPaymentId(paymentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('id')
    .eq('payment_id', paymentId)
    .single();

  if (error) {
    console.error('Error fetching receipt by payment id', error);
    return { data: null };
  }

  return { data };
}
