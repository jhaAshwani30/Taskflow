import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const res = mode === "login"
      ? await signIn(parsed.data.email, parsed.data.password)
      : await signUp(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else if (mode === "register") {
      setInfo("Check your email to confirm your account, then sign in.");
      setMode("login");
    }
  }

  return (
    <div className="w-full max-w-md glass rounded-2xl p-8 animate-fade-up shadow-2xl">
      <h1 className="text-3xl font-bold gradient-text">
        {mode === "login" ? "Welcome back" : "Create account"}
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        {mode === "login" ? "Sign in to manage your tasks." : "Start organizing your work in seconds."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1.5">Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Password</label>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div className="text-sm rounded-lg bg-destructive/15 border border-destructive/40 text-destructive-foreground px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-sm rounded-lg bg-accent/15 border border-accent/40 px-3 py-2">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
        >
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); setInfo(null); }}
        className="mt-5 text-sm text-muted-foreground hover:text-foreground transition w-full text-center"
      >
        {mode === "login" ? "No account? Register" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
