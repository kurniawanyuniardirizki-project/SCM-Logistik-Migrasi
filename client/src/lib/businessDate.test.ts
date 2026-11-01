import { describe, expect, it } from "vitest";
import {
  getBusinessDateInput,
  millisecondsUntilNextBusinessMidnight,
} from "./businessDate";

describe("Asia/Jakarta business date", () => {
  it("uses Jakarta's calendar date instead of the browser's UTC date", () => {
    expect(getBusinessDateInput(new Date("2026-09-29T16:59:59.999Z"))).toBe(
      "2026-09-29"
    );
    expect(getBusinessDateInput(new Date("2026-09-29T17:00:00.000Z"))).toBe(
      "2026-09-30"
    );
  });

  it("schedules the rollover at midnight in Jakarta", () => {
    const beforeMidnight = new Date("2026-09-29T16:59:59.999Z");
    const atMidnight = new Date("2026-09-29T17:00:00.000Z");

    expect(millisecondsUntilNextBusinessMidnight(beforeMidnight)).toBe(1);
    expect(millisecondsUntilNextBusinessMidnight(atMidnight)).toBe(
      24 * 60 * 60 * 1000
    );
  });

  it("rolls correctly over month and year boundaries", () => {
    expect(getBusinessDateInput(new Date("2026-12-31T17:00:00.000Z"))).toBe(
      "2027-01-01"
    );
    expect(
      millisecondsUntilNextBusinessMidnight(
        new Date("2026-12-31T16:00:00.000Z")
      )
    ).toBe(60 * 60 * 1000);
  });
});
