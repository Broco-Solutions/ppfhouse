import { redirect } from "next/navigation";

import { getOptionalSession } from "@/modules/identity/application/session";

export default async function RootPage() {
  const session = await getOptionalSession();
  redirect(session ? "/app" : "/login");
}
