import { describe, it, expect } from "vitest";

describe("App module (regresión TDZ)", () => {
  it("se importa sin ReferenceError de inicialización", async () => {
    const mod = await import("../App");
    expect(mod.default).toBeDefined();
  });
});
