import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useLines, useOrg } from "@/lib/org-data";
import { brl, fmtDate, income, monthRange, signedBalance } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/")({ component: Overview });

function Stat({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num mt-2 text-2xl font-semibold ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{brl(value)}</div>
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
    const { data } = await supabase.from("journal_entries").select("id,entry_date,description,mode,journal_lines(debit)").eq("org_id", orgId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(6);
    return data ?? [];
  }});
  const isChurch = org?.type === "igreja";
  return (
    <>
      <PageHeader title="Visão geral" subtitle={`Mês corrente · ${fmtDate(from)} a ${fmtDate(to)}`} actions={<Button asChild><Link to="/o/$orgId/lancamentos" params={{ orgId }}>Novo lançamento</Link></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Receitas do mês" value={r.totalReceitas} />
        <Stat label="Despesas do mês" value={r.totalDespesas} />
        <Stat label={isChurch ? (r.resultado >= 0 ? "Superávit" : "Déficit") : "Resultado"} value={r.resultado} tone={r.resultado >= 0 ? "pos" : "neg"} />
        <Stat label="Disponível (caixa e bancos)" value={cash} />
      </div>
      <div className="mt-8 rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-3"><h2 className="font-medium">Últimos lançamentos</h2><Link to="/o/$orgId/lancamentos" params={{ orgId }} className="text-sm text-primary hover:underline">Ver todos</Link></div>
        {recent.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum lançamento ainda.</p> : (
          <ul className="divide-y">
            {recent.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><div className="truncate">{e.description}</div><div className="text-xs text-muted-foreground">{fmtDate(e.entry_date)} · {e.mode === "dobrada" ? "Partida dobrada" : "Partida simples"}</div></div>
                <div className="num shrink-0">{brl(e.journal_lines.reduce((s: number, l: any) => s + +l.debit, 0) || 0)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
