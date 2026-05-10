// examples/saas-landing-page/server.mjs
//
// Zero-dependency Node.js HTTP server for the SaaS landing-page demo.
//
//   GET  /            → serves index.html (the landing page)
//   POST /api/signup  → matches the AI-CTO's contract:
//                       request:  { email: string, source?: string }
//                       response: { id: uuid, status: "queued" | "duplicate" }
//                       errors:   400 with { error: string }
//   GET  /api/signups → debug-only listing of in-memory signups
//   GET  /healthz     → liveness check
//
// Run with:
//   node server.mjs                # default port 3000
//   PORT=3737 node server.mjs      # custom port
//
// Why no Next.js? To keep the demo zero-install. The `examples/` folder must
// be runnable on a clean checkout with only Node 22+ available. The signup
// row shape is identical to the AI-generated Drizzle schema, so swapping the
// in-memory store for the real Drizzle table is a one-file change.

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  countSignups,
  insertSignup,
  listSignups,
} from "./store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, "index.html");

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const method = req.method ?? "GET";

  // --- routing ---
  if (method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveStatic(res, INDEX_PATH, "text/html; charset=utf-8");
  }

  if (method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, { ok: true, signups: countSignups() });
  }

  if (method === "GET" && url.pathname === "/api/signups") {
    return json(res, 200, { count: countSignups(), signups: listSignups() });
  }

  if (method === "POST" && url.pathname === "/api/signup") {
    return handleSignup(req, res);
  }

  return json(res, 404, { error: `not found: ${method} ${url.pathname}` });
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Paperclip landing page is live → ${url}`);
  console.log(`  POST /api/signup    accepts {email, source?} per the AI-CTO contract`);
  console.log(`  GET  /api/signups   debug listing`);
  console.log(`  GET  /healthz       liveness`);
  console.log(`Stop with Ctrl+C.`);
});

// --- handlers ---

async function handleSignup(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk.toString();

  let body;
  try {
    body = raw.length === 0 ? {} : JSON.parse(raw);
  } catch {
    return json(res, 400, { error: "invalid JSON body" });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return json(res, 400, { error: "email is required and must be a valid email address" });
  }

  const source = typeof body.source === "string" && body.source.trim().length > 0
    ? body.source.trim()
    : "landing-v1";

  const { row, status } = insertSignup({ email, source });
  return json(res, 200, { id: row.id, status });
}

// --- helpers ---

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function serveStatic(res, path, contentType) {
  let size;
  try {
    size = statSync(path).size;
  } catch (err) {
    return json(res, 500, { error: `static file missing: ${err.message}` });
  }
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": size,
    "Cache-Control": "no-store",
  });
  createReadStream(path).pipe(res);
}
