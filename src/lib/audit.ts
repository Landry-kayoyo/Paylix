import { createClient } from '@/lib/supabase/server';

export type AuditActionType =
  | 'LOGIN'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'TENANT_CREATED'
  | 'TENANT_UPDATED'
  | 'SCHOOL_YEAR_CREATED'
  | 'SCHOOL_YEAR_UPDATED'
  | 'FEE_CREATED'
  | 'FEE_UPDATED'
  | 'OBLIGATION_CREATED'
  | 'OBLIGATION_UPDATED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_GROUP_CREATED'
  | 'RECEIPT_GENERATED'
  | 'RECEIPT_CANCELLED'
  | 'PARENT_ASSOCIATED'
  | 'PERMISSION_MODIFIED'
  | 'ACCESS_DENIED'
  // Phase 14A — Paramètres & Gestion Sécurisée des Comptes
  | 'PROFILE_UPDATED'
  | 'PROFILE_EMAIL_CHANGED'
  | 'PROFILE_PASSWORD_CHANGED'
  | 'PROFILE_AVATAR_UPLOADED'
  | 'PROFILE_AVATAR_DELETED'
  | 'TENANT_SETTINGS_UPDATED'
  | 'TENANT_ASSET_UPLOADED'
  | 'PLATFORM_SETTINGS_UPDATED';

interface LogAuditParams {
  tenantId?: string;
  userId?: string;
  role?: string;
  actionType: AuditActionType;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  context?: any;
}

export async function logAudit(params: LogAuditParams) {
  try {
    const supabase = await createClient();

    // Remove any sensitive data from oldValues, newValues, and context
    const sanitize = (obj: any) => {
      if (!obj) return obj;
      const result = { ...obj };
      const sensitiveKeys = ['password', 'token', 'secret', 'key'];
      for (const key of Object.keys(result)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = sanitize(result[key]);
        }
      }
      return result;
    };

    const { error } = await supabase.from('audit_logs').insert({
      tenant_id: params.tenantId || null,
      user_id: params.userId || null,
      role: params.role || null,
      action_type: params.actionType,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      old_values: sanitize(params.oldValues) || null,
      new_values: sanitize(params.newValues) || null,
      reason: params.reason || null,
      context: sanitize(params.context) || null,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Exception during logAudit:', error);
  }
}
