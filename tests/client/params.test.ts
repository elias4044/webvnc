// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { loadParams, DEFAULT_PARAMS } from "../../src/client/utils/params.js";

describe("loadParams", () => {
  it("returns default params when no overrides present", () => {
    const params = loadParams();
    // Defaults may be overridden by URL; in test environment there are none
    expect(params.port).toBeGreaterThan(0);
    expect(params.port).toBeLessThanOrEqual(65535);
  });

  it("DEFAULT_PARAMS has required fields", () => {
    expect(DEFAULT_PARAMS.host).toBeTruthy();
    expect(DEFAULT_PARAMS.port).toBe(5900);
    expect(typeof DEFAULT_PARAMS.encrypt).toBe("boolean");
    expect(typeof DEFAULT_PARAMS.shared).toBe("boolean");
    expect(DEFAULT_PARAMS.qualityLevel).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PARAMS.qualityLevel).toBeLessThanOrEqual(9);
  });
});
