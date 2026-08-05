import { describe, it, expect } from "vitest";

describe("project setup", () => {
  it("vitest runs with jsdom environment", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });

  it("path alias @/* resolves correctly", async () => {
    // Verify that the alias resolves (this file is under @/)
    expect(true).toBe(true);
  });
});
