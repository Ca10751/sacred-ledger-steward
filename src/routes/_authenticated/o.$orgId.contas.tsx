import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useCostCenters, useLines, useMyRole } from "@/lib/org-data";
import { balanceSheet, brl, fmtDate } from "@/lib/reports";
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
  const asOf = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const { data: lines = [] } = useLines(orgId, asOf);
  const bs = balanceSheet(accounts, lines, asOf);
  const equityAccounts = bs.rows.filter((x) => x.account.type === "patrimonio");
  const [a, setA] = useState({ code: "", name: "", type: "despesa" as AccountType, analytic: true });
  const [c, setC] = useState({ code: "", name: "" });

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("accounts").insert({ ...a, org_id: orgId });
    if (error) { toast.error(error.code === "23505" ? "Código já existe" : error.message); return; }
    setA({ ...a, code: "", name: "" }); qc.invalidateQueries({ queryKey: ["accounts", orgId] }); toast.success("Conta criada");
  }
  async function addCC(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("cost_centers").insert({ ...c, org_id: orgId });
    if (error) { toast.error(error.code === "23505" ? "Código já existe" : error.message); return; }
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
        <TabsList className="flex-wrap"><TabsTrigger value="contas">Contas</TabsTrigger><TabsTrigger value="patrimonio">Patrimônio e saldos</TabsTrigger><TabsTrigger value="cc">Centros de custo</TabsTrigger></TabsList>
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
        <TabsContent value="patrimonio" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 className="font-semibold">Posição patrimonial</h2><p className="mt-1 text-xs text-muted-foreground">Saldos contabilizados até {fmtDate(asOf)} · conforme os lançamentos registrados</p></div>
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">Balanço patrimonial</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Ativo", value: bs.assets, hint: "Bens e direitos" },
                { label: "Passivo", value: bs.liabilities, hint: "Obrigações" },
                { label: "Patrimônio líquido", value: bs.equity, hint: "Patrimônio social e acumulado" },
                { label: "Resultado do exercício", value: bs.currentResult, hint: "Superávit / déficit do ano" },
              ].map((x) => <div key={x.label} className="rounded-lg bg-muted/50 p-4"><div className="text-xs font-medium text-muted-foreground">{x.label}</div><div className="num mt-2 text-xl font-semibold">{brl(x.value)}</div><div className="mt-1 text-xs text-muted-foreground">{x.hint}</div></div>)}
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="text-sm font-medium">Conferência do balanço</div><div className="mt-1 text-xs text-muted-foreground">Ativo deve corresponder ao passivo mais patrimônio líquido e resultado do exercício.</div></div>
              <div className="num text-lg font-semibold">{brl(bs.assets)} <span className="text-muted-foreground">=</span> {brl(bs.liabilitiesAndEquity)}</div>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><span className="text-lg font-semibold">i</span></span><div><h3 className="font-semibold">Como informar o patrimônio inicial?</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">O patrimônio líquido não deve ser digitado como um número isolado. Cadastre as contas patrimoniais no plano de contas e registre os saldos iniciais em um lançamento de abertura, com data-base, contas devedoras e credoras correspondentes. O lançamento precisa fechar em débitos e créditos; assim, o saldo do patrimônio social será demonstrável e auditável.</p></div></div>
            <div className="mt-4 rounded-lg bg-muted/50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Composição do patrimônio líquido</div>
              {equityAccounts.length ? <div className="mt-2 divide-y">{equityAccounts.map((x) => <div key={x.account.id} className="flex justify-between gap-4 py-2 text-sm"><span>{x.account.code} · {x.account.name}</span><span className="num font-medium">{brl(x.balance)}</span></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Ainda não há saldo contabilizado em contas de patrimônio líquido.</p>}
            </div>
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
