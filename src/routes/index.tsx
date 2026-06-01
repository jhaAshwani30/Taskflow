import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthForm } from "@/components/AuthForm";
import { TaskBoard } from "@/components/TaskBoard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flowboard — Task Manager" },
      { name: "description", content: "A vibrant task manager to move work from Todo to Done." },
      { property: "og:title", content: "Flowboard — Task Manager" },
      { property: "og:description", content: "A vibrant task manager to move work from Todo to Done." },
    ],
  }),
  component: () => (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  ),
});

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-sm text-muted-foreground animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 text-center animate-fade-up">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
            <span className="gradient-text">Flowboard</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            A bright, focused space to move tasks from Todo to Done.
          </p>
        </div>
        <AuthForm />
      </div>
    );
  }

  return <TaskBoard />;
}
