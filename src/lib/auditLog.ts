import { supabase } from './supabase';

export type AuditLogLevel = 'info' | 'warning' | 'error' | 'success';

export type AuditLogAction =
  // Authentication
  | 'login'
  | 'login_failed'
  | 'login_blocked'
  | 'logout'
  | 'signup'
  | 'signup_failed'
  | 'email_confirmed'
  // 2FA
  | '2fa_enabled'
  | '2fa_disabled'
  | '2fa_failed'
  | '2fa_blocked'
  | '2fa_success'
  // Password
  | 'password_reset'
  | 'password_reset_request'
  | 'password_changed'
  // Subscription
  | 'subscription_created'
  | 'subscription_canceled'
  | 'subscription_updated'
  | 'subscription_expired'
  | 'payment_failed'
  // Profile
  | 'profile_updated'
  | 'avatar_updated'
  // Admin
  | 'admin_action'
  | 'admin_login'
  | 'admin_user_blocked'
  | 'admin_user_unblocked'
  | 'admin_role_assigned'
  | 'admin_role_removed'
  // Data
  | 'data_exported'
  | 'data_imported'
  // Projects / Tasks / Phases / Milestones
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_deleted'
  | 'phase_created'
  | 'phase_deleted'
  | 'milestone_created'
  | 'milestone_completed'
  | 'milestone_deleted'
  | 'person_deleted';

export type EntityType =
  | 'subscription'
  | 'profile'
  | 'user'
  | 'project'
  | 'task'
  | 'phase'
  | 'milestone'
  | 'person';

interface AuditLogEntry {
  user_id?: string;
  user_email?: string;
  action: AuditLogAction;
  entity_type?: EntityType;
  entity_id?: string;
  entity_name?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  level: AuditLogLevel;
  ip_address?: string;
}

// Get user agent for logging
function getUserAgent(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.userAgent;
  }
  return 'unknown';
}

// Get current user info from Supabase session
async function getCurrentUserInfo(): Promise<{ userId: string | null; userEmail: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null
    };
  } catch {
    return { userId: null, userEmail: null };
  }
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Auto-fill user info if not provided
    let userId = entry.user_id;
    let userEmail = entry.user_email;

    if (!userId || !userEmail) {
      const userInfo = await getCurrentUserInfo();
      userId = userId || userInfo.userId || undefined;
      userEmail = userEmail || userInfo.userEmail || undefined;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId || null,
        user_email: userEmail || null,
        action: entry.action,
        entity_type: entry.entity_type || null,
        entity_id: entry.entity_id || null,
        entity_name: entry.entity_name || null,
        details: entry.details || null,
        metadata: entry.metadata || {},
        level: entry.level,
        ip_address: entry.ip_address || null,
        user_agent: getUserAgent(),
      });

    if (error) {
      // Silently fail if table doesn't exist - log to console for debugging
      console.warn('Audit log failed:', error.message);
    }
  } catch (err) {
    console.warn('Audit log error:', err);
  }
}

// Convenience functions for common actions
export const auditLog = {
  // Auth events
  login: (email: string, userId?: string) =>
    logAuditEvent({ action: 'login', user_email: email, user_id: userId, level: 'success', details: 'Login realizado com sucesso' }),

  loginFailed: (email: string, reason?: string) =>
    logAuditEvent({ action: 'login_failed', user_email: email, level: 'warning', details: reason || 'Falha na autenticação' }),

  logout: (email?: string, userId?: string) =>
    logAuditEvent({ action: 'logout', user_email: email, user_id: userId, level: 'info', details: 'Logout realizado' }),

  signup: (email: string, userId?: string) =>
    logAuditEvent({ action: 'signup', user_email: email, user_id: userId, level: 'success', details: 'Nova conta criada' }),

  signupFailed: (email: string, reason?: string) =>
    logAuditEvent({ action: 'signup_failed', user_email: email, level: 'warning', details: reason || 'Falha no cadastro' }),

  // Admin events
  adminAction: (action: string, details?: string, targetUserId?: string) =>
    logAuditEvent({
      action: 'admin_action',
      entity_type: 'user',
      entity_id: targetUserId,
      level: 'warning',
      details: details || action,
      metadata: { adminAction: action }
    }),
};
