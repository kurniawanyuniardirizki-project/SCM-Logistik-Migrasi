export default function handler(
  _req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
}
