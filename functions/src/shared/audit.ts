import { db } from './admin';
import { FieldValue } from 'firebase-admin/firestore';

export type AuditAction =
  | 'ride.created' | 'ride.accepted' | 'ride.refused' | 'ride.cancelled'
  | 'ride.arrived' | 'ride.started' | 'ride.ended' | 'ride.confirmed'
  | 'ride.disputed' | 'ride.auto_confirmed' | 'ride.absent_passenger'
  | 'scheduled.published' | 'scheduled.booked' | 'scheduled.cancelled'
  | 'payment.authorized' | 'payment.captured' | 'payment.refunded'
  | 'payment.penalty' | 'payment.transfer'
  | 'user.created' | 'user.verified' | 'user.suspended' | 'user.warned'
  | 'admin.action'
  | 'points.awarded' | 'points.redeemed'
  | 'wallet.credited' | 'wallet.debited';

export interface AuditEntry {
  action: AuditAction;
  actorId: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Écrit une entrée dans la collection audit_logs.
 * Toujours immuable côté client (write: if false dans les règles).
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  await db.collection('audit_logs').add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}
