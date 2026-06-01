/**
 * src/components/TaskBoard.tsx  (REPLACE the original)
 * Uses custom backend API instead of Supabase.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getTasks, createTask, updateTask, deleteTask, type Task, type Stage } from "@/lib/api";

const STAGES: { key: Stage; label: string; tone: string; ring: string }[] = [
  { key: "todo",        label: "Todo",        tone: "bg-todo/15 text-todo border-todo/30",                ring: "ring-todo/40" },
  { key: "in_progress", label: "In Progress", tone: "bg-progress/15 text-progress border-progress/30",   ring: "ring-progress/40" },
  { key: "done",        label: "Done",        tone: "bg-done/15 text-done border-done/30",               ring: "ring-done/40" },
];

export function TaskBoard() {
  const { user, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const task = await createTask(title.trim(), description.trim() || undefined);
      setTasks((t) => [task, ...t]);
      setTitle("");
      setDescription("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function moveTask(id: string, stage: Stage) {
    const prev = tasks;
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, stage } : x)));
    try {
      await updateTask(id, { stage });
    } catch (e: any) {
      setError(e.message);
      setTasks(prev);
    }
  }

  async function handleDelete(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== id));
    try {
      await deleteTask(id);
    } catch (e: any) {
      setError(e.message);
      setTasks(prev);
    }
  }

  function startEdit(t: Task) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDesc(t.description ?? "");
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    const patch = { title: editTitle.trim(), description: editDesc.trim() || null };
    const prev = tasks;
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setEditingId(null);
    try {
      await updateTask(id, patch);
    } catch (e: any) {
      setError(e.message);
      setTasks(prev);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Flowboard</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-secondary transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <form onSubmit={handleCreate} className="glass rounded-2xl p-5 mb-8 animate-fade-up">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a new task…"
              maxLength={200}
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              className="flex-1 rounded-lg bg-input border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap"
            >
              {creating ? "Adding…" : "Add task"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 text-sm rounded-lg bg-destructive/15 border border-destructive/40 px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {STAGES.map((s) => (
              <div key={s.key} className="glass rounded-2xl p-5 h-64 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {STAGES.map((stage) => {
              const items = tasks.filter((t) => t.stage === stage.key);
              return (
                <section key={stage.key} className="glass rounded-2xl p-5 animate-fade-up">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-sm font-semibold px-3 py-1 rounded-full border ${stage.tone}`}>
                      {stage.label}
                    </h2>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>

                  <div className="space-y-3 min-h-[100px]">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-6 text-center">
                        Nothing here yet.
                      </p>
                    )}

                    {items.map((t) => (
                      <article
                        key={t.id}
                        className={`rounded-xl bg-card/80 border border-border p-4 ring-1 ${stage.ring} hover:translate-y-[-2px] transition group`}
                      >
                        {editingId === t.id ? (
                          <div className="space-y-2">
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full rounded-md bg-input border border-border px-2 py-1.5 text-sm"
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              rows={2}
                              className="w-full rounded-md bg-input border border-border px-2 py-1.5 text-sm"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(t.id)} className="btn-primary text-xs px-3 py-1.5 rounded-md font-semibold">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-secondary">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-semibold text-sm break-words">{t.title}</h3>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-1 break-words">{t.description}</p>
                            )}

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {STAGES.filter((s) => s.key !== t.stage).map((s) => (
                                <button
                                  key={s.key}
                                  onClick={() => moveTask(t.id, s.key)}
                                  className={`text-[11px] px-2 py-1 rounded-md border ${s.tone} hover:brightness-125 transition`}
                                >
                                  → {s.label}
                                </button>
                              ))}
                            </div>

                            <div className="mt-3 flex gap-3 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => startEdit(t)} className="text-[11px] text-muted-foreground hover:text-foreground">Edit</button>
                              <button onClick={() => handleDelete(t.id)} className="text-[11px] text-destructive hover:brightness-125">Delete</button>
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
