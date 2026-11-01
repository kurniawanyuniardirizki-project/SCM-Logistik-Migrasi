import { describe, expect, it } from "vitest";
import { getStockDateWindow } from "./db";

describe("stock transaction date windows", () => {
  it("includes UTC timestamps that belong to the selected Jakarta calendar day", () => {
    const window = getStockDateWindow("2026-09-28", "Asia/Jakarta");

    expect(window.start.toISOString()).toBe("2026-09-27T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-28T17:00:00.000Z");

    const postedAt = new Date("2026-09-27T19:03:11.000Z");
    expect(postedAt >= window.start && postedAt < window.end).toBe(true);
  });

  it("uses a 23-hour window when the selected local day starts daylight saving time", () => {
    const window = getStockDateWindow("2026-03-08", "America/New_York");

    expect(window.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(window.end.getTime() - window.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("uses a 25-hour window when the selected local day ends daylight saving time", () => {
    const window = getStockDateWindow("2026-11-01", "America/New_York");

    expect(window.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(window.end.getTime() - window.start.getTime()).toBe(25 * 60 * 60 * 1000);
  });
});
