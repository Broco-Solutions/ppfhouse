import "dotenv/config";

import { prisma } from "../src/infrastructure/db/client";
import { logger } from "../src/infrastructure/logging/logger";
import { reconcileServiceCaseFinances } from "../src/modules/finance/application/finance-reconciliation";
import { reconcileInventory } from "../src/modules/inventory/application/inventory-service";

async function main() {
  const [inventory, finances, purchases, consumptions] = await Promise.all([
    reconcileInventory(),
    reconcileServiceCaseFinances(),
    prisma.purchase.findMany({
      select: {
        id: true,
        financialEntry: { select: { id: true } },
        items: { select: { inventoryMovement: { select: { id: true } } } },
      },
    }),
    prisma.jobMaterialConsumption.findMany({
      select: { id: true, movement: { select: { id: true } } },
    }),
  ]);
  const stockMismatches = inventory.filter((item) => !item.matches).length;
  const financeMismatches = finances.filter((item) => !item.matches).length;
  const purchaseLinkMismatches = purchases.filter(
    (purchase) =>
      !purchase.financialEntry ||
      purchase.items.some((item) => !item.inventoryMovement),
  ).length;
  const consumptionLinkMismatches = consumptions.filter(
    (consumption) => !consumption.movement,
  ).length;
  const mismatches =
    stockMismatches +
    financeMismatches +
    purchaseLinkMismatches +
    consumptionLinkMismatches;

  logger.info("domain_reconciliation_completed", {
    inventoryItems: inventory.length,
    serviceCases: finances.length,
    purchases: purchases.length,
    consumptions: consumptions.length,
    mismatches,
  });
  if (mismatches > 0) process.exitCode = 1;
}

main()
  .catch(() => {
    logger.error("domain_reconciliation_failed");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
