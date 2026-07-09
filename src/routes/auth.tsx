import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Ingresar · Category IQ" }] }),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  if (user) {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setMsg("Cuenta creada. Revisa tu correo si se pide confirmación, o ya puedes iniciar sesión.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (e: any) {
      setErr(e?.message ?? "Ocurrió un error");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setErr(null);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) setErr(String((r.error as any)?.message ?? r.error));
    } catch (e: any) { setErr(e?.message ?? "Error con Google"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold">Category IQ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin" ? "Inicia sesión para acceder a tus categorías" : "Crea tu cuenta"}
        </p>

        <button
          onClick={google} disabled={busy}
          className="mt-5 w-full rounded-md border border-border bg-white text-black text-sm font-medium py-2 hover:bg-neutral-100 disabled:opacity-50"
        >
          Continuar con Google
        </button>

        <div className="my-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> o con correo <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="tu@correo.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <input type="password" required minLength={6} placeholder="Contraseña" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {busy ? "…" : mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
        {msg && <p className="mt-3 text-xs text-emerald-600">{msg}</p>}

        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setMsg(null); }}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground underline">
          {mode === "signin" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Tus datos (categorías, claims, precios, histórico) se guardan en la nube y quedan
          disponibles en cualquier dispositivo donde inicies sesión.
        </p>
      </div>
    </div>
  );
}
