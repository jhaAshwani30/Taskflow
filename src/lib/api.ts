/**
 * taskflow-api.ts
 * Drop-in API client for the TaskFlow custom backend.
 * Place this in: src/lib/api.ts
 *
 * Usage — replace Supabase calls in auth-context.tsx and TaskBoard.tsx
 * with these functions.
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── token storage ──────────────────────────────────────────────────────────
export function getToken() { return localStorage.getItem("tf_token"); }
export function setToken(t: string) { localStorage.setItem("tf_token", t); }
export function clearToken() { localStorage.removeItem("tf_token"); }

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export type AuthUser = { id: string; email: string };

export async function register(email: string, password: string): Promise<{ user: AuthUser }> {
  const data = await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return { user: data.user };
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  const data = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return { user: data.user };
}

export async function getMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    const data = await apiFetch("/api/auth/me");
    return data.user;
  } catch {
    clearToken();
    return null;
  }
}

export function logout() { clearToken(); }

// ── Tasks ──────────────────────────────────────────────────────────────────
export type Stage = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  stage: Stage;
  created_at: string;
  updated_at: string;
}

export async function getTasks(): Promise<Task[]> {
  const data = await apiFetch("/api/tasks");
  return data.tasks;
}

export async function createTask(title: string, description?: string, stage?: Stage): Promise<Task> {
  const data = await apiFetch("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title, description: description || null, stage: stage || "todo" }),
  });
  return data.task;
}

export async function updateTask(id: string, patch: Partial<Pick<Task, "title" | "description" | "stage">>): Promise<Task> {
  const data = await apiFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
}