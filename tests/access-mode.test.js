import { describe, expect, it } from "bun:test";
import { FREE_ACCESS } from "../src/lib/access-mode.ts";

describe("temporary free access", () => {
  it("keeps paid-plan gating disabled", () => {
    expect(FREE_ACCESS).toBe(true);
  });
});