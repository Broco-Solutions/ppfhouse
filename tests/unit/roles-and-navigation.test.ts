import { describe, expect, it } from "vitest";

import { getNavigationForRole } from "@/modules/identity/application/navigation";
import { hasRole, isUserRole } from "@/modules/identity/domain/roles";

describe("roles and navigation", () => {
  it("recognizes only the two contractual roles", () => {
    expect(isUserRole("ADMIN")).toBe(true);
    expect(isUserRole("STAFF")).toBe(true);
    expect(isUserRole("OWNER")).toBe(false);
  });

  it("keeps ADMIN-only navigation away from STAFF", () => {
    const staffLabels = getNavigationForRole("STAFF").map((item) => item.label);
    const adminLabels = getNavigationForRole("ADMIN").map((item) => item.label);

    expect(staffLabels).not.toContain("Administración");
    expect(staffLabels).not.toContain("Finanzas");
    expect(staffLabels).not.toContain("Sueldos");
    expect(staffLabels).not.toContain("Compras");
    expect(adminLabels).toContain("Administración");
    expect(adminLabels).toContain("Finanzas");
    expect(adminLabels).toContain("Sueldos");
    expect(adminLabels).toContain("Compras");
    expect(staffLabels).toContain("Inventario");
    expect(adminLabels).toContain("Inventario");
    expect(hasRole("STAFF", ["ADMIN"])).toBe(false);
  });
});
