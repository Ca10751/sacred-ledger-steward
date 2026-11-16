import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, PeriodPicker } from "@/components/app/PageHeader";
import { useAccounts, useCostCenters, useLines, useOrg } from "@/lib/org-data";
import { balanceSheet, brl, downloadCsv, fmtDate, income, monthRange, trialBalance, type Acc, type Line } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/relatorios")({ component: Relatorios });

function Relatorios() {
  const { orgId } = Route.useParams();
  const { data: org } = useOrg(orgId);
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: ccs = [] } = useCostCenters(orgId);
  const [{ from, to }, setP] = useState(monthRange());
  const [cc, setCc] = useState("");
  const { data: all = [] } = useLines(orgId, to);
  const lines = useMemo(() => (cc ? all.filter((l) => l.cost_center_id === cc) : all), [all, cc]);
  const isChurch = org?.type === "igreja";
  const dre = income(accounts, lines, from, to);
  const tb = trialBalance(accounts, lines, from, to);
  const bp = balanceSheet(accounts, lines, to);
  const exportDreCsv = () => downloadCsv(`dre-${from}-${to}.csv`, ["Tipo", "Código", "Conta", "Valor"], [
    ...dre.receitas.map((x) => ["Receita", x.account.code, x.account.name, x.value]),
    ...dre.despesas.map((x) => ["Despesa", x.account.code, x.account.name, x.value]),
  ]);
  const exportTrialCsv = () => downloadCsv(`balancete-${from}-${to}.csv`, ["Código", "Conta", "Saldo anterior", "Débitos", "Créditos", "Saldo atual"], tb.rows.map((x) => [x.account.code, x.account.name, x.opening, x.debit, x.credit, x.closing]));
  const exportBalanceCsv = () => downloadCsv(`balanco-${to}.csv`, ["Grupo", "Código", "Conta", "Saldo"], bp.rows.map((x) => [x.account.type, x.account.code, x.account.name, x.balance]));
  const exportLinesCsv = () => downloadCsv(`lancamentos-${from}-${to}.csv`, ["Data", "Código", "Conta", "Débito", "Crédito", "Congregação", "Centro de custo"], lines.filter((l) => l.date >= from && l.date <= to).map((l) => {
    const account = accounts.find((a) => a.id === l.account_id);
    return [l.date, account?.code ?? "", account?.name ?? "", l.debit, l.credit, l.congregation_id ?? "", l.cost_center_id ?? ""];
  }));
  return (
    <>
      <PageHeader title="Relatórios" subtitle={`${org?.name ?? ""} · ${fmtDate(from)} a ${fmtDate(to)}`} actions={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={exportDreCsv}>CSV DRE</Button><Button size="sm" variant="outline" onClick={exportTrialCsv}>CSV Balancete</Button><Button size="sm" variant="outline" onClick={exportBalanceCsv}>CSV BP</Button><Button size="sm" variant="outline" onClick={exportLinesCsv}>CSV Lançamentos</Button><Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button></div>} />
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PeriodPicker from={from} to={to} onChange={(f, t) => setP({ from: f, to: t })} />
        <select value={cc} onChange={(e) => setCc(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
          <option value="">Todos os centros de custo</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="report-heading mb-4 hidden text-center print:block"><h1 className="text-lg font-bold">{org?.name}</h1><p className="text-sm">Relatórios contábeis · {fmtDate(from)} a {fmtDate(to)}</p></div>
      <Tabs defaultValue="dre">
        <TabsList className="no-print flex-wrap"><TabsTrigger value="dre">{isChurch ? "Demonstração do Superávit" : "DRE"}</TabsTrigger><TabsTrigger value="bal">Balancete</TabsTrigger><TabsTrigger value="bp">Balanço Patrimonial</TabsTrigger><TabsTrigger value="raz">Razonetes</TabsTrigger></TabsList>
        <TabsContent value="dre" className="mt-4"><DRE accounts={accounts} lines={lines} from={from} to={to} church={isChurch} /></TabsContent>
        <TabsContent value="bal" className="mt-4"><Balancete accounts={accounts} lines={lines} from={from} to={to} /></TabsContent>
        <TabsContent value="bp" className="mt-4"><BalanceSheet accounts={accounts} lines={lines} asOf={to} /></TabsContent>
        <TabsContent value="raz" className="mt-4"><Razonetes accounts={accounts} lines={lines} from={from} to={to} /></TabsContent>
      </Tabs>
      <div className="mt-12 hidden grid-cols-2 gap-12 text-center text-sm print:grid"><div className="border-t pt-2">Presidente / Responsável legal</div><div className="border-t pt-2">Contador(a) · CRC</div></div>
    </>
  );
}

type P = { accounts: Acc[]; lines: Line[]; from: string; to: string };
const Row = ({ label, value, strong, code }: { label: string; value: number; strong?: boolean; code?: string }) => (
  <div className={`flex justify-between gap-4 px-5 py-2 text-sm ${strong ? "bg-muted/50 font-semibold" : ""}`}>
    <span>{code && <span className="num mr-2 text-muted-foreground">{code}</span>}{label}</span><span className="num">{brl(value)}</span>
  </div>
);

function DRE({ accounts, lines, from, to, church }: P & { church?: boolean }) {
  const r = income(accounts, lines, from, to);
  return (
    <div className="divide-y rounded-lg border bg-card">
      <div className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Receitas</div>
      {r.receitas.map((x) => <Row key={x.account.id} code={x.account.code} label={x.account.name} value={x.value} />)}
      <Row label="Total das receitas" value={r.totalReceitas} strong />
      <div className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{church ? "Despesas" : "Custos e despesas"}</div>
      {r.despesas.map((x) => <Row key={x.account.id} code={x.account.code} label={x.account.name} value={x.value} />)}
      <Row label="Total das despesas" value={r.totalDespesas} strong />
      <div className={`flex justify-between px-5 py-4 text-base font-semibold ${r.resultado >= 0 ? "text-success" : "text-destructive"}`}>
        <span>{church ? (r.resultado >= 0 ? "Superávit do período" : "Déficit do período") : (r.resultado >= 0 ? "Lucro do período" : "Prejuízo do período")}</span><span className="num">{brl(r.resultado)}</span>
      </div>
    </div>
  );
}

function Balancete({ accounts, lines, from, to }: P) {
  const tb = trialBalance(accounts, lines, from, to);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-2.5 text-left">Conta</th><th className="px-4 py-2.5 text-right">Saldo anterior</th><th className="px-4 py-2.5 text-right">Débitos</th><th className="px-4 py-2.5 text-right">Créditos</th><th className="px-4 py-2.5 text-right">Saldo atual</th></tr>
        </thead>
        <tbody>
          {tb.rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sem movimento.</td></tr>}
          {tb.rows.map((r) => (
            <tr key={r.account.id} className="border-b">
              <td className="whitespace-nowrap px-4 py-2"><span className="num text-muted-foreground">{r.account.code}</span> {r.account.name}</td>
              <td className="num px-4 py-2 text-right">{brl(r.opening)}</td><td className="num px-4 py-2 text-right">{brl(r.debit)}</td>
              <td className="num px-4 py-2 text-right">{brl(r.credit)}</td><td className="num px-4 py-2 text-right font-medium">{brl(r.closing)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="bg-muted/50 font-semibold"><td className="px-4 py-2.5">Totais</td><td /><td className="num px-4 py-2.5 text-right">{brl(tb.totalDebit)}</td><td className="num px-4 py-2.5 text-right">{brl(tb.totalCredit)}</td>
          <td className={`px-4 py-2.5 text-right text-xs ${tb.totalDebit === tb.totalCredit ? "text-success" : "text-destructive"}`}>{tb.totalDebit === tb.totalCredit ? "Débitos = Créditos" : "Divergência (partidas simples)"}</td></tr></tfoot>
      </table>
    </div>
  );
}

function BalanceSheet({ accounts, lines, asOf }: { accounts: Acc[]; lines: Line[]; asOf: string }) {
  const bp = balanceSheet(accounts, lines, asOf);
  const groups = [
    { title: "Ativo", type: "ativo" as const, total: bp.assets },
    { title: "Passivo", type: "passivo" as const, total: bp.liabilities },
    { title: "Patrimônio líquido", type: "patrimonio" as const, total: bp.equity },
  ];
  return <div className="space-y-4">
    <div className="rounded-lg border bg-card">
      <div className="border-b px-5 py-3 text-center"><div className="font-semibold">Balanço Patrimonial</div><div className="text-xs text-muted-foreground">Posição em {fmtDate(asOf)}</div></div>
      {groups.map((g) => <section key={g.type} className="border-b last:border-0">
        <div className="bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wider">{g.title}</div>
        {bp.rows.filter((x) => x.account.type === g.type).map((x) => <Row key={x.account.id} code={x.account.code} label={x.account.name} value={x.balance} />)}
        <Row label={`Total do ${g.title.toLowerCase()}`} value={g.total} strong />
      </section>)}
      <section className="border-t-2 px-5 py-3">
        <div className="flex justify-between text-sm"><span>Resultado do exercício ainda não encerrado</span><span className="num">{brl(bp.currentResult)}</span></div>
        <div className="mt-2 flex justify-between font-semibold"><span>Passivo + Patrimônio líquido + Resultado</span><span className="num">{brl(bp.liabilitiesAndEquity)}</span></div>
        <div className="mt-1 flex justify-between text-sm"><span>Ativo</span><span className="num">{brl(bp.assets)}</span></div>
        <p className={`mt-2 text-xs ${Math.abs(bp.assets - bp.liabilitiesAndEquity) < 0.01 ? "text-success" : "text-destructive"}`}>{Math.abs(bp.assets - bp.liabilitiesAndEquity) < 0.01 ? "Balanço patrimonial equilibrado." : "Atenção: ativo e passivo + patrimônio + resultado apresentam diferença."}</p>
      </section>
    </div>
    <p className="text-xs text-muted-foreground">O resultado do exercício é apresentado separadamente. Esta tela não realiza lançamento de encerramento nem substitui a conferência das contas e dos saldos anteriores.</p>
  </div>;
}

function Razonetes({ accounts, lines, from, to }: P) {
  const moved = accounts.filter((a) => lines.some((l) => l.account_id === a.id && l.date >= from && l.date <= to));
  if (!moved.length) return <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Sem movimento no período.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {moved.map((a) => {
        const ls = lines.filter((l) => l.account_id === a.id && l.date >= from && l.date <= to);
        const d = ls.reduce((s, l) => s + l.debit, 0), c = ls.reduce((s, l) => s + l.credit, 0);
        return (
          <div key={a.id} className="break-inside-avoid rounded-lg border bg-card p-4">
            <div className="mb-2 text-center text-sm font-medium"><span className="num text-muted-foreground">{a.code}</span> {a.name}</div>
            <div className="grid grid-cols-2 border-t-2 border-foreground text-sm">
              <div className="border-r-2 border-foreground pr-2 pt-1 text-right">{ls.filter((l) => l.debit).map((l, i) => <div key={i} className="num">{brl(l.debit)}</div>)}</div>
              <div className="pl-2 pt-1">{ls.filter((l) => l.credit).map((l, i) => <div key={i} className="num">{brl(l.credit)}</div>)}</div>
            </div>
            <div className="mt-1 grid grid-cols-2 border-t text-sm font-medium"><div className="num pr-2 text-right">{brl(d)}</div><div className="num pl-2">{brl(c)}</div></div>
            <div className="mt-1 text-center text-xs text-muted-foreground">Saldo {d >= c ? "devedor" : "credor"}: <span className="num">{brl(Math.abs(d - c))}</span></div>
          </div>
        );
      })}
    </div>
  );
}
