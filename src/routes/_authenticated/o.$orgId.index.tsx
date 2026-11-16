import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Banknote, BookOpen, Building2, CalendarDays, Church, CirclePlus, FileBarChart2, Landmark, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useLines, useOrg } from "@/lib/org-data";
import { brl, fmtDate, income, monthRange, signedBalance } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/")({ component: Overview });

function StatCard({ label, value, icon: Icon, tone, note }: { label: string; value: number; icon: typeof Wallet; tone?: "positive" | "negative"; note: string }) {
  return (
    <div className="group rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      </div>
      <div className={`num mt-4 text-2xl font-semibold tracking-tight ${tone === "positive" ? "text-success" : tone === "negative" ? "text-destructive" : ""}`}>{brl(value)}</div>
      <div className="mt-2 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function Overview() {
  const { orgId } = Route.useParams();
  const { from, to } = monthRange();
  const { data: org } = useOrg(orgId);
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: lines = [] } = useLines(orgId, to);
  const r = income(accounts, lines, from, to);
  const cash = accounts.filter((a) => a.code.startsWith("1.1.0") && a.analytic).reduce((s, a) => {
    const ls = lines.filter((l) => l.account_id === a.id);
    return s + signedBalance(a.type, ls.reduce((x, l) => x + l.debit, 0), ls.reduce((x, l) => x + l.credit, 0));
  }, 0);
  const { data: recent = [] } = useQuery({ queryKey: ["recent", orgId], queryFn: async () => {
    const { data, error } = await supabase.from("journal_entries").select("id,entry_date,description,mode,journal_lines(debit,credit)").eq("org_id", orgId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(6);
    if (error) throw error;
    return data ?? [];
  }});
  const isChurch = org?.type === "igreja";
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    const result = income(accounts, lines, start, end);
    return { label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), receitas: result.totalReceitas, despesas: result.totalDespesas };
  });
  const maxBar = Math.max(1, ...months.flatMap((m) => [m.receitas, m.despesas]));
  const totalMovimento = r.totalReceitas + r.totalDespesas;

  return (
    <div className="space-y-7">
      <div className="rounded-2xl bg-primary px-6 py-6 text-primary-foreground shadow-sm sm:px-8 sm:py-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground/70"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Painel financeiro</div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{org?.name ?? "Sua organização"}</h1>
            <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">Acompanhe a movimentação contábil, consulte relatórios e mantenha sua escrituração em dia.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-primary-foreground/80"><CalendarDays className="h-4 w-4" />{fmtDate(from)} – {fmtDate(to)}</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="font-medium"><Link to="/o/$orgId/lancamentos" params={{ orgId }}><CirclePlus className="mr-2 h-4 w-4" />Novo lançamento</Link></Button>
          <Button asChild variant="outline" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/o/$orgId/relatorios" params={{ orgId }}><FileBarChart2 className="mr-2 h-4 w-4" />Ver relatórios</Link></Button>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="font-semibold tracking-tight">Resumo do período</h2><p className="text-xs text-muted-foreground">Indicadores do mês corrente</p></div>
          <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">Atualizado em tempo real</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Receitas" value={r.totalReceitas} icon={ArrowDownRight} tone="positive" note="Entradas contabilizadas no mês" />
          <StatCard label="Despesas" value={r.totalDespesas} icon={ArrowUpRight} tone="negative" note="Saídas contabilizadas no mês" />
          <StatCard label={isChurch ? (r.resultado >= 0 ? "Superávit do mês" : "Déficit do mês") : "Resultado do mês"} value={r.resultado} icon={Banknote} tone={r.resultado >= 0 ? "positive" : "negative"} note="Receitas menos despesas" />
          <StatCard label="Caixa e bancos" value={cash} icon={Wallet} note="Saldo das contas disponíveis" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><h2 className="font-semibold">Movimentação financeira</h2><p className="mt-1 text-xs text-muted-foreground">Receitas e despesas · últimos seis meses</p></div>
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">6 meses</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Receitas</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Despesas</span></div>
          <div className="mt-5 grid h-44 grid-cols-6 items-end gap-3 border-b pb-1 sm:gap-5">
            {months.map((m, i) => <div key={m.label + i} className="flex h-full flex-col items-center justify-end gap-2">
              <div className="flex h-full w-full items-end justify-center gap-1.5">
                <div title={`Receitas: ${brl(m.receitas)}`} className="w-3 rounded-t-sm bg-primary/90 transition-all sm:w-5" style={{ height: `${Math.max(m.receitas > 0 ? 4 : 0, m.receitas / maxBar * 100)}%` }} />
                <div title={`Despesas: ${brl(m.despesas)}`} className="w-3 rounded-t-sm bg-amber-500/85 transition-all sm:w-5" style={{ height: `${Math.max(m.despesas > 0 ? 4 : 0, m.despesas / maxBar * 100)}%` }} />
              </div>
              <span className="text-[11px] capitalize text-muted-foreground">{m.label}</span>
            </div>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-3"><div className="text-xs text-muted-foreground">Total de receitas</div><div className="num mt-1 font-semibold text-success">{brl(months.reduce((s, m) => s + m.receitas, 0))}</div></div>
            <div className="rounded-lg bg-muted/60 p-3"><div className="text-xs text-muted-foreground">Total de despesas</div><div className="num mt-1 font-semibold">{brl(months.reduce((s, m) => s + m.despesas, 0))}</div></div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4"><h2 className="font-semibold">Acesso rápido</h2><p className="mt-1 text-xs text-muted-foreground">Principais áreas do sistema</p></div>
          <div className="space-y-2">
            <Link to="/o/$orgId/lancamentos" params={{ orgId }} className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><BookOpen className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Lançamentos</span><span className="block text-xs text-muted-foreground">Partidas simples e dobradas</span></span><span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link to="/o/$orgId/contas" params={{ orgId }} className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-700"><Landmark className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Plano de contas</span><span className="block text-xs text-muted-foreground">Estrutura contábil da organização</span></span><span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link to="/o/$orgId/relatorios" params={{ orgId }} className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><FileBarChart2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Relatórios contábeis</span><span className="block text-xs text-muted-foreground">DRE, balancete e balanço</span></span><span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
            </Link>
            {isChurch && <Link to="/o/$orgId/igreja" params={{ orgId }} className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Church className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Gestão da igreja</span><span className="block text-xs text-muted-foreground">Dízimos, ofertas e congregações</span></span><span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
            </Link>}
            <Link to="/empresas" className="group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700"><Building2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Organizações</span><span className="block text-xs text-muted-foreground">Alternar entre empresas e igrejas</span></span><span className="text-muted-foreground transition group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div><h2 className="font-semibold">Últimos lançamentos</h2><p className="mt-0.5 text-xs text-muted-foreground">Movimentações registradas recentemente</p></div>
          <Link to="/o/$orgId/lancamentos" params={{ orgId }} className="text-sm font-medium text-primary hover:underline">Ver todos</Link>
        </div>
        {recent.length === 0 ? <div className="px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" /></span><p className="mt-3 text-sm font-medium">Nenhum lançamento registrado</p><p className="mt-1 text-xs text-muted-foreground">Quando houver movimentações, elas aparecerão aqui.</p><Button asChild size="sm" className="mt-4"><Link to="/o/$orgId/lancamentos" params={{ orgId }}>Criar primeiro lançamento</Link></Button></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Descrição</th><th className="px-5 py-3 font-medium">Data</th><th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 text-right font-medium">Valor</th></tr></thead><tbody className="divide-y">
            {recent.map((e: any) => <tr key={e.id} className="transition hover:bg-muted/30"><td className="max-w-[280px] truncate px-5 py-3 font-medium">{e.description}</td><td className="num whitespace-nowrap px-5 py-3 text-muted-foreground">{fmtDate(e.entry_date)}</td><td className="px-5 py-3 text-muted-foreground">{e.mode === "dobrada" ? "Partida dobrada" : "Partida simples"}</td><td className="num whitespace-nowrap px-5 py-3 text-right font-medium">{brl((e.journal_lines ?? []).reduce((s: number, l: any) => s + Number(l.debit), 0))}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{isChurch ? "Gestão contábil e administrativa da igreja" : "Gestão contábil e financeira da empresa"}</span><span>{accounts.length} contas no plano de contas · {totalMovimento > 0 ? "Movimentação no mês" : "Aguardando movimentação"}</span></div>
    </div>
  );
}
