import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/org-data";

export const Route = createFileRoute("/_authenticated/o/$orgId/membros")({ component: Membros });
const roles = { admin: "Administrador", contador: "Contador", leitor: "Leitor" } as const;
type Role = keyof typeof roles;

function Membros() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const { data: myRole } = useMyRole(orgId);
  const isAdmin = myRole === "admin";
  const { data = [] } = useQuery({ queryKey: ["members", orgId], queryFn: async () => {
    const { data: ms, error } = await supabase.from("organization_members").select("*").eq("org_id", orgId);
    if (error) throw error;
    const { data: ps } = await supabase.from("profiles").select("id,full_name,email").in("id", ms.map((m) => m.user_id));
    return ms.map((m) => ({ ...m, profile: ps?.find((p) => p.id === m.user_id) }));
  }});
  const [email, setEmail] = useState(""); const [role, setRole] = useState<Role>("contador");
  const refresh = () => qc.invalidateQueries({ queryKey: ["members", orgId] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("add_member_by_email", { _org: orgId, _email: email, _role: role });
    if (error) { toast.error(error.message); return; }
    setEmail(""); refresh(); toast.success("Usuário adicionado");
  }
  async function change(id: string, r: Role) { const { error } = await supabase.from("organization_members").update({ role: r }).eq("id", id); if (error) toast.error(error.message); refresh(); }
  async function remove(id: string) { if (!confirm("Remover acesso deste usuário?")) return; const { error } = await supabase.from("organization_members").delete().eq("id", id); if (error) toast.error(error.message); refresh(); }

  return (
    <>
      <PageHeader title="Usuários e permissões" subtitle="Administradores gerenciam acessos; contadores lançam; leitores apenas consultam." />
      {isAdmin && (
        <form onSubmit={add} className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_180px_auto]">
          <Input type="email" placeholder="E-mail do usuário cadastrado" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <Button>Adicionar</Button>
        </form>
      )}
      <div className="divide-y rounded-lg border bg-card">
        {data.map((m: any) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1"><div className="font-medium">{m.profile?.full_name || m.profile?.email || "Usuário"}</div><div className="text-xs text-muted-foreground">{m.profile?.email}</div></div>
            {isAdmin ? (
              <>
                <select value={m.role} onChange={(e) => change(m.id, e.target.value as Role)} className="h-8 rounded-md border border-input bg-card px-2 text-sm">{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <button onClick={() => remove(m.id)} className="text-xs text-muted-foreground hover:text-destructive">Remover</button>
              </>
            ) : <span className="rounded bg-muted px-2 py-0.5 text-xs">{roles[m.role as Role]}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
