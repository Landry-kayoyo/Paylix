import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:support@paylix.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function sendWebPush(subscription: webpush.PushSubscription, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (error) {
    console.error('Error sending web push:', error);
    return { success: false, error };
  }
}
