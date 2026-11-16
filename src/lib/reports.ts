export type AccountType = "ativo" | "passivo" | "patrimonio" | "receita" | "despesa";
export interface Acc { id: string; code: string; name: string; type: AccountType; analytic: boolean; church_kind?: string | null }
export interface Line { account_id: string; debit: number; credit: number; date: string; congregation_id?: string | null; cost_center_id?: string | null }

/** Ativo e Despesa têm natureza devedora; demais, credora. */
export const isDebitNature = (t: AccountType) => t === "ativo" || t === "despesa";
export const signedBalance = (t: AccountType, d: number, c: number) => (isDebitNature(t) ? d - c : c - d);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function trialBalance(accounts: Acc[], lines: Line[], from: string, to: string) {
  const rows = accounts
    .filter((a) => a.analytic)
    .map((a) => {
      let od = 0, oc = 0, d = 0, c = 0;
      for (const l of lines) {
        if (l.account_id !== a.id || l.date > to) continue;
        if (l.date < from) { od += +l.debit; oc += +l.credit; } else { d += +l.debit; c += +l.credit; }
      }
      const opening = r2(signedBalance(a.type, od, oc));
      return { account: a, opening, debit: r2(d), credit: r2(c), closing: r2(opening + signedBalance(a.type, d, c)) };
    })
    .filter((r) => r.opening || r.debit || r.credit)
    .sort((x, y) => x.account.code.localeCompare(y.account.code, undefined, { numeric: true }));
  const totalDebit = r2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = r2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDebit, totalCredit };
}

export function income(accounts: Acc[], lines: Line[], from: string, to: string) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const sums = new Map<string, number>();
  for (const l of lines) {
    if (l.date < from || l.date > to) continue;
    const a = byId.get(l.account_id);
    if (!a || (a.type !== "receita" && a.type !== "despesa")) continue;
    sums.set(a.id, (sums.get(a.id) ?? 0) + signedBalance(a.type, +l.debit, +l.credit));
  }
  const list = (t: AccountType) =>
    [...sums.entries()].map(([id, v]) => ({ account: byId.get(id)!, value: r2(v) }))
      .filter((x) => x.account.type === t && x.value !== 0)
      .sort((x, y) => x.account.code.localeCompare(y.account.code, undefined, { numeric: true }));
  const receitas = list("receita"), despesas = list("despesa");
  const totalReceitas = r2(receitas.reduce((s, x) => s + x.value, 0));
  const totalDespesas = r2(despesas.reduce((s, x) => s + x.value, 0));
  return { receitas, despesas, totalReceitas, totalDespesas, resultado: r2(totalReceitas - totalDespesas) };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (d: string) => d.split("-").reverse().join("/");
export function monthRange(ref = new Date()) {
  const y = ref.getFullYear(), m = ref.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}
