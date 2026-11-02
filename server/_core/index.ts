
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { appRouter } from "../routers";
import { getPublicStockSummary } from "../publicStockSummary";
import { createContext } from "./context";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
  });

  app.options("/api/public/stock-summary", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");
    res.status(204).end();
  });

  app.get("/api/public/stock-summary", async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "no-store");

    try {
      const summary = await getPublicStockSummary();
      res.json(summary);
    } catch (error) {
      console.warn("[Public stock summary] unavailable:", error);
      res.status(503).json({
        message: "Ringkasan stok Pisang belum tersedia.",
      });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // Vite hanya dimuat untuk server lokal, bukan Vercel.
  const { setupVite, serveStatic } = await import("./vite.js");

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || 3000);

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Vercel menggunakan createApp() melalui server.ts.
if (!process.env.VERCEL) {
  startServer().catch(console.error);
}
