import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useCostCenters, useMyRole } from "@/lib/org-data";
import type { AccountType } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/contas")({ component: Contas });
const typeLabel: Record<AccountType, string> = { ativo: "Ativo", passivo: "Passivo", patrimonio: "Patrimônio Líquido", receita: "Receita", despesa: "Despesa" };
const sel = "h-9 rounded-md border border-input bg-card px-2 text-sm";

function Contas() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const { data: role } = useMyRole(orgId);
  const canWrite = role === "admin" || role === "contador";
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: ccs = [] } = useCostCenters(orgId);
  const [a, setA] = useState({ code: "", name: "", type: "despesa" as AccountType, analytic: true });
  const [c, setC] = useState({ code: "", name: "" });

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("accounts").insert({ ...a, org_id: orgId });
    if (error) return toast.error(error.code === "23505" ? "Código já existe" : error.message);
    setA({ ...a, code: "", name: "" }); qc.invalidateQueries({ queryKey: ["accounts", orgId] }); toast.success("Conta criada");
  }
  async function addCC(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("cost_centers").insert({ ...c, org_id: orgId });
    if (error) return toast.error(error.code === "23505" ? "Código já existe" : error.message);
    setC({ code: "", name: "" }); qc.invalidateQueries({ queryKey: ["cc", orgId] }); toast.success("Centro de custo criado");
  }
  async function delAccount(id: string) {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) toast.error("Conta com lançamentos não pode ser excluída"); else qc.invalidateQueries({ queryKey: ["accounts", orgId] });
  }

  return (
    <>
      <PageHeader title="Plano de contas" subtitle="Contas sintéticas agrupam; lançamentos são feitos em contas analíticas." />
      <Tabs defaultValue="contas">
        <TabsList><TabsTrigger value="contas">Contas</TabsTrigger><TabsTrigger value="cc">Centros de custo</TabsTrigger></TabsList>
        <TabsContent value="contas" className="mt-4 space-y-4">
          {canWrite && (
            <form onSubmit={addAccount} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[120px_1fr_170px_130px_auto]">
              <Input placeholder="Código" value={a.code} onChange={(e) => setA({ ...a, code: e.target.value })} required className="num" />
              <Input placeholder="Nome da conta" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} required />
              <select className={sel} value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as AccountType })}>
                {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className={sel} value={a.analytic ? "1" : "0"} onChange={(e) => setA({ ...a, analytic: e.target.value === "1" })}>
                <option value="1">Analítica</option><option value="0">Sintética</option>
              </select>
              <Button>Adicionar</Button>
            </form>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5">Código</th><th className="px-4 py-2.5">Conta</th><th className="px-4 py-2.5">Grupo</th><th className="px-4 py-2.5">Tipo</th><th /></tr></thead>
              <tbody>
                {accounts.map((x) => (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="num px-4 py-2">{x.code}</td>
                    <td className={`px-4 py-2 ${x.analytic ? "" : "font-semibold"}`} style={{ paddingLeft: `${1 + (x.code.split(".").length - 1) * 1}rem` }}>{x.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{typeLabel[x.type]}</td>
                    <td className="px-4 py-2 text-muted-foreground">{x.analytic ? "Analítica" : "Sintética"}</td>
                    <td className="px-4 py-2 text-right">{canWrite && <button onClick={() => delAccount(x.id)} className="text-xs text-muted-foreground hover:text-destructive">Excluir</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="cc" className="mt-4 space-y-4">
          {canWrite && (
            <form onSubmit={addCC} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[120px_1fr_auto]">
              <Input placeholder="Código" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} required className="num" />
              <Input placeholder="Nome do centro de custo" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required />
              <Button>Adicionar</Button>
            </form>
          )}
          <div className="rounded-lg border bg-card divide-y">
            {ccs.map((x) => <div key={x.id} className="flex gap-4 px-4 py-2.5 text-sm"><span className="num w-16 text-muted-foreground">{x.code}</span>{x.name}</div>)}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
