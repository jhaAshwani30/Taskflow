# TaskFlow Backend

A lightweight, **zero-npm-dependency** REST API backend for the TaskFlow task manager.

Built with **Node.js 22 built-ins only**:
- `node:http` — HTTP server
- `node:sqlite` — SQLite database (Node 22 experimental built-in)
- `node:crypto` — Password hashing (PBKDF2) + JWT signing (HS256)

---

## Quick Start

### Prerequisites
- **Node.js 22+** (for built-in SQLite support)

### Run the backend

```bash
# Clone / enter the backend folder
cd taskflow-backend

# Start (no npm install needed!)
node --experimental-sqlite server.mjs
```

Server starts at **http://localhost:3001**

### Environment variables (optional)

```bash
PORT=3001                          # default: 3001
JWT_SECRET=your-secret-here        # default: built-in (change in production!)
DB_PATH=./taskflow.db              # default: ./taskflow.db
```

```bash
JWT_SECRET=mysecret PORT=4000 node --experimental-sqlite server.mjs
```

---

## API Endpoints

### Auth

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | `{email, password}` | Create account, returns JWT |
| POST | `/api/auth/login` | `{email, password}` | Login, returns JWT |
| GET | `/api/auth/me` | — | Get current user (auth required) |

### Tasks (all require `Authorization: Bearer <token>`)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/tasks` | — | List all tasks for current user |
| POST | `/api/tasks` | `{title, description?, stage?}` | Create task |
| PATCH | `/api/tasks/:id` | `{title?, description?, stage?}` | Update task |
| DELETE | `/api/tasks/:id` | — | Delete task |

### Stage values: `"todo"` \| `"in_progress"` \| `"done"`

---

## Connect the Frontend

### 1. Copy these files into the frontend

```
taskflow-api.ts          → src/lib/api.ts
auth-context-custom.tsx  → src/lib/auth-context.tsx   (REPLACE original)
TaskBoard-custom.tsx     → src/components/TaskBoard.tsx (REPLACE original)
```

### 2. Add env variable to frontend `.env`

```
VITE_API_URL=http://localhost:3001
```

For production, set `VITE_API_URL` to your deployed backend URL.

### 3. Remove Supabase dependency (optional)

The frontend no longer needs:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars

---

## Test the API (curl)

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Create a task
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Ship the feature","stage":"todo"}'

# List tasks
curl http://localhost:3001/api/tasks \
  -H "Authorization: Bearer $TOKEN"

# Move to in_progress
curl -X PATCH http://localhost:3001/api/tasks/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"stage":"in_progress"}'

# Delete
curl -X DELETE http://localhost:3001/api/tasks/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## Deploying the Backend (Bonus)

### Railway (recommended free tier)

1. Push `server.mjs` + `package.json` to a GitHub repo
2. Create new project on [railway.app](https://railway.app)
3. Set start command: `node --experimental-sqlite server.mjs`
4. Set env var: `JWT_SECRET=<strong-random-string>`
5. Copy the public URL → set `VITE_API_URL` in frontend

### Render

1. New Web Service → connect repo
2. Build command: *(leave empty)*
3. Start command: `node --experimental-sqlite server.mjs`
4. Add env var: `JWT_SECRET=<strong-random-string>`

---

## Technical Decisions & Tradeoffs

| Decision | Rationale |
|----------|-----------|
| Zero npm dependencies | Faster setup, no `npm install`, no supply-chain risk |
| Node 22 built-in SQLite | No `better-sqlite3` native build needed; works anywhere Node 22 runs |
| PBKDF2 for passwords | Strong (100k iterations), available via `node:crypto` without bcrypt |
| Manual JWT (HS256) | 30 lines of crypto, no library, fully auditable |
| SQLite local file | Perfect for local dev and demo; swap DB_PATH to a mounted volume in prod |
| Optimistic UI in frontend | Tasks update instantly; rollback on API error for snappy UX |

---

## Assumptions

- This backend is intended for local dev / demo; for production, use a persistent volume for the SQLite file or swap to Postgres
- JWT expiry is 7 days; no refresh token (acceptable for a task manager demo)
- Email confirmation flow is skipped (no email provider needed)