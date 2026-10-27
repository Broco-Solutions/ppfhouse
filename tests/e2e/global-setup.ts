import "dotenv/config";

import { upsertE2EUsers } from "./auth.fixtures";

export default async function globalSetup() {
  await upsertE2EUsers();
}
