import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, PeriodPicker } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useCongregations, useLines, useMyRole, useOrg } from "@/lib/org-data";
import { brl, fmtDate, income, monthRange } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/igreja")({ component: Igreja });
const kinds = { dizimo: "Dízimo", oferta: "Oferta", missoes: "Oferta missionária", outro: "Outra receita" } as const;
type Kind = keyof typeof kinds;
const sel = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

function Igreja() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const { data: org } = useOrg(orgId);
  const { data: role } = useMyRole(orgId);
  const canWrite = role === "admin" || role === "contador";
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: congs = [] } = useCongregations(orgId);
  const [{ from, to }, setP] = useState(monthRange());
  const { data: lines = [] } = useLines(orgId, to);
  const { data: contribs = [] } = useQuery({ queryKey: ["contribs", orgId, from, to], queryFn: async () => {
    const { data, error } = await supabase.from("contributions").select("*, congregations(name)").eq("org_id", orgId).gte("contribution_date", from).lte("contribution_date", to).order("contribution_date", { ascending: false });
    if (error) throw error; return data;
  }});
  const cashAccs = accounts.filter((a) => a.type === "ativo" && a.analytic && a.code.startsWith("1.1"));
  const [f, setF] = useState({ kind: "dizimo" as Kind, contributor: "", amount: "", date: new Date().toISOString().slice(0, 10), congregation_id: "", cash_id: "" });
  const [cg, setCg] = useState({ name: "", city: "", leader: "" });

  async function addContrib(e: React.FormEvent) {
    e.preventDefault();
    const rev = accounts.find((a) => a.church_kind === f.kind);
    const cash = f.cash_id || cashAccs[0]?.id;
    if (!rev || !cash) return toast.error("Configure as contas de receita e caixa no plano de contas");
    const amount = +f.amount;
    const { data: entryId, error } = await supabase.rpc("create_journal_entry", {
      _org: orgId, _date: f.date, _description: `${kinds[f.kind]}${f.contributor ? " — " + f.contributor : ""}`, _document: "", _mode: "dobrada",
      _lines: [{ account_id: cash, debit: amount, credit: 0, congregation_id: f.congregation_id }, { account_id: rev.id, debit: 0, credit: amount, congregation_id: f.congregation_id }],
    });
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase.from("contributions").insert({ org_id: orgId, entry_id: entryId, kind: f.kind, contributor: f.contributor || null, amount, contribution_date: f.date, congregation_id: f.congregation_id || null });
    if (e2) return toast.error(e2.message);
    toast.success("Contribuição registrada e contabilizada");
    setF({ ...f, contributor: "", amount: "" });
    ["contribs", "lines", "entries", "recent"].forEach((k) => qc.invalidateQueries({ queryKey: [k, orgId] }));
  }
  async function addCong(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("congregations").insert({ ...cg, org_id: orgId });
    if (error) return toast.error(error.message);
    setCg({ name: "", city: "", leader: "" }); qc.invalidateQueries({ queryKey: ["cong", orgId] }); toast.success("Congregação adicionada");
  }

  if (org && org.type !== "igreja") return <p className="text-sm text-muted-foreground">Módulo disponível apenas para igrejas.</p>;
  const r = income(accounts, lines, from, to);
  const byKind = (Object.keys(kinds) as Kind[]).map((k) => ({ k, v: contribs.filter((c: any) => c.kind === k).reduce((s: number, c: any) => s + +c.amount, 0) }));
  const congResult = [...congs, { id: null as any, name: "Sem congregação" }].map((c) => {
    const ls = lines.filter((l) => (l.congregation_id ?? null) === c.id);
    const x = income(accounts, ls, from, to);
    return { name: c.name, ...x };
  }).filter((x) => x.totalReceitas || x.totalDespesas);

  return (
    <>
      <PageHeader title="Gestão da igreja" subtitle="Dízimos, ofertas, congregações e prestação de contas" />
      <div className="no-print mb-4"><PeriodPicker from={from} to={to} onChange={(a, b) => setP({ from: a, to: b })} /></div>
      <Tabs defaultValue="contrib">
        <TabsList className="no-print flex-wrap"><TabsTrigger value="contrib">Contribuições</TabsTrigger><TabsTrigger value="cong">Congregações</TabsTrigger><TabsTrigger value="prest">Prestação de contas</TabsTrigger></TabsList>

        <TabsContent value="contrib" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {byKind.map((x) => <div key={x.k} className="rounded-lg border bg-card p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">{kinds[x.k]}</div><div className="num mt-1 text-lg font-semibold">{brl(x.v)}</div></div>)}
          </div>
          {canWrite && (
            <form onSubmit={addContrib} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Tipo</Label><select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Kind })}>{Object.entries(kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="space-y-1.5"><Label>Contribuinte (opcional)</Label><Input value={f.contributor} onChange={(e) => setF({ ...f, contributor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor</Label><Input type="number" step="0.01" min="0.01" className="num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Congregação</Label><select className={sel} value={f.congregation_id} onChange={(e) => setF({ ...f, congregation_id: e.target.value })}><option value="">—</option>{congs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-1.5"><Label>Recebido em</Label><select className={sel} value={f.cash_id} onChange={(e) => setF({ ...f, cash_id: e.target.value })}>{cashAccs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div className="sm:col-span-3 flex justify-end"><Button>Registrar contribuição</Button></div>
            </form>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5">Contribuinte</th><th className="px-4 py-2.5">Congregação</th><th className="px-4 py-2.5 text-right">Valor</th></tr></thead>
              <tbody>
                {contribs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhuma contribuição no período.</td></tr>}
                {contribs.map((c: any) => <tr key={c.id} className="border-b last:border-0"><td className="num px-4 py-2">{fmtDate(c.contribution_date)}</td><td className="px-4 py-2">{kinds[c.kind as Kind]}</td><td className="px-4 py-2">{c.contributor ?? "—"}</td><td className="px-4 py-2 text-muted-foreground">{c.congregations?.name ?? "—"}</td><td className="num px-4 py-2 text-right">{brl(+c.amount)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="cong" className="mt-4 space-y-4">
          {canWrite && (
            <form onSubmit={addCong} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input placeholder="Nome" value={cg.name} onChange={(e) => setCg({ ...cg, name: e.target.value })} required />
              <Input placeholder="Cidade" value={cg.city} onChange={(e) => setCg({ ...cg, city: e.target.value })} />
              <Input placeholder="Dirigente" value={cg.leader} onChange={(e) => setCg({ ...cg, leader: e.target.value })} />
              <Button>Adicionar</Button>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {congs.map((c) => <div key={c.id} className="rounded-lg border bg-card p-4"><div className="font-medium">{c.name}</div><div className="mt-1 text-sm text-muted-foreground">{[c.city, c.leader].filter(Boolean).join(" · ") || "—"}</div></div>)}
          </div>
        </TabsContent>

        <TabsContent value="prest" className="mt-4 space-y-4">
          <div className="flex justify-between"><h2 className="text-lg font-semibold">Prestação de contas — {fmtDate(from)} a {fmtDate(to)}</h2><Button variant="outline" className="no-print" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Receitas</div><div className="num mt-1 text-xl font-semibold">{brl(r.totalReceitas)}</div></div>
            <div className="rounded-lg border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Despesas</div><div className="num mt-1 text-xl font-semibold">{brl(r.totalDespesas)}</div></div>
            <div className="rounded-lg border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">{r.resultado >= 0 ? "Superávit" : "Déficit"}</div><div className={`num mt-1 text-xl font-semibold ${r.resultado >= 0 ? "text-success" : "text-destructive"}`}>{brl(r.resultado)}</div></div>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5">Congregação</th><th className="px-4 py-2.5 text-right">Receitas</th><th className="px-4 py-2.5 text-right">Despesas</th><th className="px-4 py-2.5 text-right">Resultado</th></tr></thead>
              <tbody>
                {congResult.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sem movimento.</td></tr>}
                {congResult.map((c) => <tr key={c.name} className="border-b last:border-0"><td className="px-4 py-2">{c.name}</td><td className="num px-4 py-2 text-right">{brl(c.totalReceitas)}</td><td className="num px-4 py-2 text-right">{brl(c.totalDespesas)}</td><td className={`num px-4 py-2 text-right font-medium ${c.resultado >= 0 ? "text-success" : "text-destructive"}`}>{brl(c.resultado)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[["Receitas", r.receitas], ["Despesas", r.despesas]].map(([t, list]: any) => (
              <div key={t} className="rounded-lg border bg-card"><div className="border-b px-4 py-2.5 text-sm font-medium">{t} por conta</div>
                {list.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">—</p> : list.map((x: any) => <div key={x.account.id} className="flex justify-between px-4 py-2 text-sm"><span>{x.account.name}</span><span className="num">{brl(x.value)}</span></div>)}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Relatório para apreciação do Conselho Fiscal e da Assembleia, conforme o estatuto da entidade.</p>
        </TabsContent>
      </Tabs>
    </>
  );
}
