// @vitest-environment node
import { describe, it, expect } from "vitest";

describe("Ventas module", () => {
  it("imports without TDZ", async () => {
    const mod = await import("../pages/Ventas");
    expect(mod.default).toBeDefined();
  });
});
