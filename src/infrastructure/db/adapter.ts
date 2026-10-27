import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";

export function createPostgresAdapter(connectionString: string) {
  const localPrismaDev = connectionString.includes("localhost:51214");

  if (!localPrismaDev) return new PrismaPg({ connectionString });

  const statementPrefix = randomBytes(6).toString("hex");
  let statementCounter = 0;

  return new PrismaPg(
    {
      connectionString,
      // Prisma Dev exposes a deliberately small local connection budget.
      // Keeping each pool bounded avoids exhausting it when the app and test
      // clients coexist during E2E runs.
      max: 2,
    },
    {
      // Prisma Dev's PGlite proxy shares prepared-statement state between
      // logical connections. Unique names keep independent clients isolated.
      statementNameGenerator: () =>
        `ferraro_${statementPrefix}_${statementCounter++}`,
    },
  );
}
