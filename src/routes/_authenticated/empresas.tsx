import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Church, LogOut, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({ meta: [{ title: "Organizações — Escritura" }, { name: "description", content: "Selecione a empresa ou igreja para trabalhar." }] }),
  component: Empresas,
});

const roleLabel = { admin: "Administrador", contador: "Contador", leitor: "Leitor" } as const;

function Empresas() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-orgs"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("organization_members").select("role, organizations(*)").eq("user_id", u.user!.id);
    if (error) throw error; return data;
  }});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [doc, setDoc] = useState(""); const [type, setType] = useState<"empresa" | "igreja">("empresa");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("organizations").insert({ name, document: doc || null, type, created_by: u.user!.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Organização criada com plano de contas padrão");
    setOpen(false); setName(""); setDoc(""); qc.invalidateQueries({ queryKey: ["my-orgs"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">E</span>Escritura</div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-semibold tracking-tight">Suas organizações</h1><p className="mt-1 text-sm text-muted-foreground">Escolha uma empresa ou igreja para acessar a escrituração.</p></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Nova organização</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova organização</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["empresa", "igreja"] as const).map((t) => (
                    <button type="button" key={t} onClick={() => setType(t)} className={`flex items-center gap-2 rounded-md border p-3 text-sm ${type === t ? "border-primary bg-accent" : ""}`}>
                      {t === "empresa" ? <Building2 className="h-4 w-4" /> : <Church className="h-4 w-4" />}{t === "empresa" ? "Empresa" : "Igreja"}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5"><Label>Nome / Razão social</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>CNPJ (opcional)</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
                <Button className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : !data?.length ? (
          <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nenhuma organização ainda. Crie a primeira para começar.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.map((m: any) => (
              <Link key={m.organizations.id} to="/o/$orgId" params={{ orgId: m.organizations.id }} className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
                <div className="grid h-11 w-11 place-items-center rounded-md bg-accent text-accent-foreground">{m.organizations.type === "igreja" ? <Church className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.organizations.name}</div>
                  <div className="text-xs text-muted-foreground">{m.organizations.type === "igreja" ? "Igreja" : "Empresa"} · {roleLabel[m.role as keyof typeof roleLabel]}{m.organizations.document ? ` · ${m.organizations.document}` : ""}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
