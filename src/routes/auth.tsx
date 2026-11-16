import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Entrar — Sapucaí Tropicalis" },
    { name: "description", content: "Acesse sua conta para gerenciar a contabilidade das suas organizações." },
    { property: "og:title", content: "Entrar — Sapucaí Tropicalis" },
    { property: "og:description", content: "Acesse sua conta Sapucaí Tropicalis." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/empresas" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) nav({ to: "/empresas" }); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha inválidos");
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
      if (error) toast.error(error.message); else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    }
    setBusy(false);
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-7 shadow-sm">
        <div className="mb-6"><BrandLogo className="mx-auto h-20 w-full max-w-[300px]" /></div>
        <h1 className="text-xl font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "up" && <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>}
          <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label>Senha</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Criar conta"}</Button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />ou<div className="h-px flex-1 bg-border" /></div>
        <button type="button" onClick={google} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continuar com Google
        </button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "in" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Criar conta" : "Entrar"}</button>
        </p>
      </div>
    </div>
  );
}
