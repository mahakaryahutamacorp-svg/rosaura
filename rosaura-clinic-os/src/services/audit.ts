import type { Prisma, PrismaClient } from "@prisma/client";

type AuditDb = Prisma.TransactionClient | PrismaClient;

export async function writeAudit(
  db: AuditDb,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
) {
  await db.auditLog.create({
    data: { actorUserId, action, entityType, entityId, summary },
  });
}
