import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

describe("report and stock public access", () => {
  it("allows anonymous visitors to read report and stock data", async () => {
    const caller = appRouter.createCaller(makeContext());

    await expect(caller.report.list()).resolves.toEqual([]);
    await expect(caller.stock.list({ reportDate: "2026-09-28" })).resolves.toMatchObject({
      transactions: expect.any(Array),
      balances: expect.any(Array),
    });
  });
});
