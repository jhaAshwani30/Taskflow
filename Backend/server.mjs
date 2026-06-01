/**
 * TaskFlow Backend
 * Node 22+, zero npm deps — uses node:http, node:sqlite, node:crypto
 * Auth: JWT (HS256 with crypto.createHmac)
 * DB:  SQLite (node:sqlite experimental)
 */

import http from "node:http";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-super-secret-key";
const DB_PATH = process.env.DB_PATH || "./taskflow.db";

// ── Database ─────────────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    stage TEXT NOT NULL DEFAULT 'todo' CHECK (stage IN ('todo','in_progress','done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
`);

// ── Crypto helpers ────────────────────────────────────────────────────────────
function hashPassword(password) {
  // PBKDF2 with 100k iterations — strong enough for local/demo use
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

// Minimal JWT (HS256) — no library needed
function base64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
function jwtSign(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
function jwtVerify(token) {
  const parts = token?.split(".");
  if (parts?.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function getToken(req) {
  const auth = req.headers["authorization"] || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

function requireAuth(req, res) {
  const token = getToken(req);
  const payload = jwtVerify(token);
  if (!payload) {
    send(res, 401, { error: "Unauthorized" });
    return null;
  }
  return payload;
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    });
    return res.end();
  }

  try {
    // ── Auth routes ────────────────────────────────────────────────────────
    if (path === "/api/auth/register" && method === "POST") {
      const { email, password } = await readBody(req);
      if (!email || !password) return send(res, 400, { error: "email and password required" });
      if (password.length < 6) return send(res, 400, { error: "Password must be at least 6 characters" });

      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
      if (existing) return send(res, 409, { error: "Email already registered" });

      const id = crypto.randomUUID();
      const hash = hashPassword(password);
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email.toLowerCase().trim(), hash);

      const token = jwtSign({ sub: id, email: email.toLowerCase().trim() });
      return send(res, 201, { token, user: { id, email: email.toLowerCase().trim() } });
    }

    if (path === "/api/auth/login" && method === "POST") {
      const { email, password } = await readBody(req);
      if (!email || !password) return send(res, 400, { error: "email and password required" });

      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
      if (!user || !verifyPassword(password, user.password_hash)) {
        return send(res, 401, { error: "Invalid email or password" });
      }

      const token = jwtSign({ sub: user.id, email: user.email });
      return send(res, 200, { token, user: { id: user.id, email: user.email } });
    }

    if (path === "/api/auth/me" && method === "GET") {
      const payload = requireAuth(req, res);
      if (!payload) return;
      const user = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").get(payload.sub);
      if (!user) return send(res, 404, { error: "User not found" });
      return send(res, 200, { user });
    }

    // ── Task routes ────────────────────────────────────────────────────────
    if (path === "/api/tasks" && method === "GET") {
      const payload = requireAuth(req, res);
      if (!payload) return;
      const tasks = db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC").all(payload.sub);
      return send(res, 200, { tasks });
    }

    if (path === "/api/tasks" && method === "POST") {
      const payload = requireAuth(req, res);
      if (!payload) return;
      const { title, description, stage } = await readBody(req);
      if (!title?.trim()) return send(res, 400, { error: "title is required" });

      const validStages = ["todo", "in_progress", "done"];
      const taskStage = validStages.includes(stage) ? stage : "todo";
      const id = crypto.randomUUID();

      db.prepare(
        "INSERT INTO tasks (id, user_id, title, description, stage) VALUES (?, ?, ?, ?, ?)"
      ).run(id, payload.sub, title.trim(), description?.trim() || null, taskStage);

      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      return send(res, 201, { task });
    }

    // PATCH /api/tasks/:id
    const patchMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (patchMatch && method === "PATCH") {
      const payload = requireAuth(req, res);
      if (!payload) return;
      const taskId = patchMatch[1];

      const existing = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(taskId, payload.sub);
      if (!existing) return send(res, 404, { error: "Task not found" });

      const body = await readBody(req);
      const validStages = ["todo", "in_progress", "done"];

      const title = body.title !== undefined ? body.title.trim() : existing.title;
      const description = body.description !== undefined ? (body.description?.trim() || null) : existing.description;
      const stage = body.stage !== undefined && validStages.includes(body.stage) ? body.stage : existing.stage;

      if (!title) return send(res, 400, { error: "title cannot be empty" });

      db.prepare(
        "UPDATE tasks SET title = ?, description = ?, stage = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
      ).run(title, description, stage, taskId, payload.sub);

      const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
      return send(res, 200, { task });
    }

    // DELETE /api/tasks/:id
    const deleteMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const payload = requireAuth(req, res);
      if (!payload) return;
      const taskId = deleteMatch[1];

      const existing = db.prepare("SELECT id FROM tasks WHERE id = ? AND user_id = ?").get(taskId, payload.sub);
      if (!existing) return send(res, 404, { error: "Task not found" });

      db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(taskId, payload.sub);
      return send(res, 200, { success: true });
    }

    // Health
    if (path === "/api/health" && method === "GET") {
      return send(res, 200, { status: "ok", time: new Date().toISOString() });
    }

    send(res, 404, { error: "Not found" });

  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`✅ TaskFlow backend running on http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/auth/register`);
  console.log(`     POST /api/auth/login`);
  console.log(`     GET  /api/auth/me`);
  console.log(`     GET  /api/tasks`);
  console.log(`     POST /api/tasks`);
  console.log(`     PATCH  /api/tasks/:id`);
  console.log(`     DELETE /api/tasks/:id`);
  console.log(`     GET  /api/health`);
});
