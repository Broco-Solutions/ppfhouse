import { prisma } from "@/infrastructure/db/client";
import { logger } from "@/infrastructure/logging/logger";
import { deletePrivateObject } from "@/infrastructure/storage/private-storage";

// The queue is committed with the database deletion, so a storage outage never
// leaves inaccessible files without a durable retry path.
export async function cleanupDeletedRecordFiles(limit = 100) {
  const batch = await prisma.pendingStorageDeletion.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  let removed = 0;
  for (const entry of batch) {
    try {
      await deletePrivateObject(entry.objectKey);
      await prisma.pendingStorageDeletion.deleteMany({
        where: { id: entry.id },
      });
      removed += 1;
    } catch {
      logger.warn("deleted_record_file_cleanup_pending", {
        cleanupId: entry.id,
      });
    }
  }
  return {
    examined: batch.length,
    removed,
    hasMore: batch.length === limit && removed === batch.length,
  };
}
