import "dotenv/config";

import { removeE2EUsers } from "./auth.fixtures";

export default async function globalTeardown() {
  await removeE2EUsers();
}
