import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Authentication is intentionally disabled for this deployment. All report,
// stock, and system procedures are publicly callable as requested.
export const protectedProcedure = publicProcedure;
export const adminProcedure = publicProcedure;
