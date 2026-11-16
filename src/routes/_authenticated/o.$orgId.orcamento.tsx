import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Plus, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useCostCenters, useCongregations, useLines, useMyRole } from "@/lib/org-data";
import { brl, downloadCsv } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/orcamento")({ component: AnnualBudget });

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const yearNow = new Date().getFullYear();
const dateForYear = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31` });
const emptyMonths = () => Array.from({ length: 12 }, () => "");

function AnnualBudget() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const db = supabase as any;
  const [year, setYear] = useState(yearNow);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [selectedCongregation, setSelectedCongregation] = useState("");
  const [description, setDescription] = useState("");
  const [monthly, setMonthly] = useState<string[]>(emptyMonths());
  const { data: role } = useMyRole(orgId);
  const canWrite = role === "admin" || role === "contador";
  const isAdmin = role === "admin";
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: costCenters = [] } = useCostCenters(orgId);
  const { data: congregations = [] } = useCongregations(orgId);
  const { from, to } = dateForYear(year);
  const { data: ledgerLines = [] } = useLines(orgId, to);
  const expenseAccounts = accounts.filter((a) => a.analytic && a.type === "despesa");

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ["annual-budget-plan", orgId, year],
    queryFn: async () => {
      const { data, error } = await db.from("annual_budget_plans").select("*").eq("org_id", orgId).eq("fiscal_year", year).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["annual-budget-items", orgId, plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await db.from("annual_budget_items").select("*, accounts(code,name), cost_centers(name), congregations(name)").eq("org_id", orgId).eq("budget_id", plan!.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => items.map((item: any) => {
    const planned = Array.isArray(item.monthly_values) ? item.monthly_values.map((v: unknown) => Number(v) || 0) : Array.from({ length: 12 }, (_, i) => Number(item.monthly_values?.[String(i + 1)] ?? 0));
    const actual = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return ledgerLines.filter((line) => {
        if (line.account_id !== item.account_id || line.date.slice(0, 4) !== String(year) || Number(line.date.slice(5, 7)) !== month) return false;
        if (item.cost_center_id && line.cost_center_id !== item.cost_center_id) return false;
        if (item.congregation_id && line.congregation_id !== item.congregation_id) return false;
        return true;
      }).reduce((sum, line) => sum + line.debit - line.credit, 0);
    });
    return { ...item, planned, actual, plannedTotal: planned.reduce((a: number, b: number) => a + b, 0), actualTotal: actual.reduce((a: number, b: number) => a + b, 0) };
  }), [items, ledgerLines, year]);

  const totals = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    month: monthNames[i],
    planned: rows.reduce((s: number, r: any) => s + r.planned[i], 0),
    actual: rows.reduce((s: number, r: any) => s + r.actual[i], 0),
  })), [rows]);
  const annualPlanned = totals.reduce((s, x) => s + x.planned, 0);
  const annualActual = totals.reduce((s, x) => s + x.actual, 0);
  const variance = annualPlanned - annualActual;
  const approved = plan?.status === "approved" || plan?.status === "closed";

  async function createPlan() {
    const { error } = await db.from("annual_budget_plans").insert({ org_id: orgId, fiscal_year: year, status: "draft" });
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["annual-budget-plan", orgId, year] });
    toast.success("Planejamento anual criado");
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!plan?.id || !selectedAccount) return;
    const values = monthly.map((v) => Math.max(0, Number(v) || 0));
    if (values.every((v) => v === 0)) { toast.error("Informe o orçamento de pelo menos um mês"); return; }
    const { error } = await db.from("annual_budget_items").insert({
      org_id: orgId, budget_id: plan.id, account_id: selectedAccount,
      cost_center_id: selectedCostCenter || null, congregation_id: selectedCongregation || null,
      description: description.trim() || null, monthly_values: values,
    });
    if (error) { toast.error(error.message); return; }
    setSelectedAccount(""); setSelectedCostCenter(""); setSelectedCongregation(""); setDescription(""); setMonthly(emptyMonths());
    await qc.invalidateQueries({ queryKey: ["annual-budget-items", orgId, plan.id] });
    toast.success("Categoria adicionada ao planejamento");
  }

  async function removeItem(id: string) {
    if (!plan?.id || approved || !confirm("Remover esta categoria do planejamento?")) return;
    const { error } = await db.from("annual_budget_items").delete().eq("id", id).eq("org_id", orgId);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["annual-budget-items", orgId, plan.id] });
  }

  async function approvePlan() {
    if (!plan?.id || !isAdmin) return;
    if (!confirm("Aprovar o orçamento anual? A aprovação bloqueará a edição dos valores planejados.")) return;
    const { error } = await db.from("annual_budget_plans").update({ status: "approved", approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() }).eq("id", plan.id).eq("org_id", orgId).eq("status", "draft");
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["annual-budget-plan", orgId, year] });
    toast.success("Planejamento aprovado");
  }

  function exportBudget() {
    downloadCsv(`planejamento-gastos-${year}.csv`, ["Categoria", "Centro de custo", "Congregação", ...monthNames, "Previsto anual", "Realizado anual", "Saldo"],
      rows.map((r: any) => [r.accounts?.name ?? r.account_id, r.cost_centers?.name ?? "", r.congregations?.name ?? "", ...r.planned, r.plannedTotal, r.actualTotal, r.plannedTotal - r.actualTotal]));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Planejamento anual de gastos" subtitle="Orçamento por categoria, mês, centro de custo e congregação, comparado com a execução contábil." actions={<Button variant="outline" onClick={exportBudget} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="budget-year">Exercício</Label><Input id="budget-year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value) || yearNow)} className="w-28" /></div>
        {plan && <span className="mb-2 rounded-full border px-3 py-1 text-xs font-medium">{plan.status === "approved" ? "Aprovado" : plan.status === "closed" ? "Encerrado" : "Rascunho"}</span>}
        {approved && <span className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Valores planejados bloqueados</span>}
      </div>

      {planLoading || itemsLoading ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Carregando planejamento…</div> : !plan ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <h2 className="font-semibold">Nenhum planejamento para {year}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Crie o orçamento anual para começar a distribuir os gastos previstos por categoria e mês.</p>
          {canWrite && <Button className="mt-4" onClick={createPlan}><Plus className="mr-2 h-4 w-4" />Criar planejamento de {year}</Button>}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Total previsto</div><div className="num mt-2 text-2xl font-semibold">{brl(annualPlanned)}</div></div>
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Total realizado</div><div className="num mt-2 text-2xl font-semibold">{brl(annualActual)}</div></div>
            <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{variance >= 0 ? "Saldo do orçamento" : "Excesso sobre o orçamento"}</div><div className={`num mt-2 text-2xl font-semibold ${variance >= 0 ? "text-success" : "text-destructive"}`}>{brl(Math.abs(variance))}</div></div>
          </div>

          {canWrite && !approved && (
            <form onSubmit={addItem} className="space-y-4 rounded-xl border bg-card p-4">
              <div><h2 className="font-semibold">Adicionar categoria ao orçamento</h2><p className="text-xs text-muted-foreground">O valor realizado será calculado automaticamente pelos lançamentos de despesas.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1"><Label>Conta de despesa</Label><select required value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Selecione</option>{expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></div>
                <div className="space-y-1"><Label>Centro de custo</Label><select value={selectedCostCenter} onChange={(e) => setSelectedCostCenter(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Todos</option>{costCenters.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></div>
                <div className="space-y-1"><Label>Congregação</Label><select value={selectedCongregation} onChange={(e) => setSelectedCongregation(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Todas</option>{congregations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="space-y-1"><Label>Observação</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {monthNames.map((m, i) => <div key={m} className="space-y-1"><Label>{m}</Label><Input type="number" min="0" step="0.01" placeholder="R$ 0,00" value={monthly[i]} onChange={(e) => setMonthly((old) => old.map((v, n) => n === i ? e.target.value : v))} /></div>)}
              </div>
              <div className="flex justify-end"><Button type="submit"><Plus className="mr-2 h-4 w-4" />Adicionar ao orçamento</Button></div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h2 className="font-semibold">Previsto x realizado por mês</h2><p className="text-xs text-muted-foreground">Realizado apurado no razão contábil de {year}</p></div>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Mês</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3 text-right">Realizado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Execução</th></tr></thead>
              <tbody>{totals.map((m) => { const diff = m.planned - m.actual; const pct = m.planned > 0 ? Math.min(100, m.actual / m.planned * 100) : m.actual > 0 ? 100 : 0; return <tr key={m.month} className="border-t"><td className="px-4 py-2.5">{m.month}</td><td className="num px-4 py-2.5 text-right">{brl(m.planned)}</td><td className="num px-4 py-2.5 text-right">{brl(m.actual)}</td><td className={`num px-4 py-2.5 text-right font-medium ${diff < 0 ? "text-destructive" : ""}`}>{brl(diff)}</td><td className="px-4 py-2.5"><div className="h-2 min-w-24 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${diff < 0 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div></td></tr>; })}</tbody>
              <tfoot className="border-t bg-muted/30 font-semibold"><tr><td className="px-4 py-3">Total anual</td><td className="num px-4 py-3 text-right">{brl(annualPlanned)}</td><td className="num px-4 py-3 text-right">{brl(annualActual)}</td><td className="num px-4 py-3 text-right">{brl(variance)}</td><td className="px-4 py-3">—</td></tr></tfoot>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><div><h2 className="font-semibold">Orçamento por categoria</h2><p className="text-xs text-muted-foreground">Detalhamento anual por conta, centro de custo e congregação</p></div>{isAdmin && plan.status === "draft" && <Button size="sm" onClick={approvePlan}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar planejamento</Button>}</div>
            <table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Centro / congregação</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3 text-right">Realizado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3" /></tr></thead><tbody>
              {rows.map((r: any) => <tr key={r.id} className="border-t"><td className="px-4 py-2.5"><div className="font-medium">{r.accounts?.name ?? "Conta"}</div><div className="text-xs text-muted-foreground">{r.accounts?.code} {r.description ? `· ${r.description}` : ""}</div></td><td className="px-4 py-2.5 text-muted-foreground">{[r.cost_centers?.name, r.congregations?.name].filter(Boolean).join(" · ") || "Geral"}</td><td className="num px-4 py-2.5 text-right">{brl(r.plannedTotal)}</td><td className="num px-4 py-2.5 text-right">{brl(r.actualTotal)}</td><td className={`num px-4 py-2.5 text-right font-medium ${r.actualTotal > r.plannedTotal ? "text-destructive" : ""}`}>{brl(r.plannedTotal - r.actualTotal)}</td><td className="px-4 py-2.5 text-right">{canWrite && !approved && <button className="text-xs text-destructive hover:underline" onClick={() => removeItem(r.id)}>Remover</button>}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhuma categoria cadastrada no planejamento.</td></tr>}
            </tbody></table>
          </div>
          {plan.status === "draft" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Rascunho editável. Somente administradores podem aprovar o planejamento.</p>}
        </>
      )}
    </div>
  );
}
