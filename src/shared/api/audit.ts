import type { AuditEntry, ActionId } from '@shared/types/actions'

const auditLog: AuditEntry[] = []

function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function writeAudit(entry: Omit<AuditEntry, 'audit_id' | 'ts'>): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    audit_id: uuid(),
    ts: Date.now()
  }
  auditLog.push(full)
  console.log('[AUDIT]', JSON.stringify(full))
  return full
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog]
}

export function clearAuditLog(): void {
  auditLog.length = 0
}

export type { ActionId }
