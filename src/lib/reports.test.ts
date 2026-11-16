import { describe, it, expect } from "vitest";
import { trialBalance, income, type Acc } from "./reports";
const A: Acc[] = [
  { id: "cx", code: "1.1.01", name: "Caixa", type: "ativo", analytic: true },
  { id: "dz", code: "4.1.01", name: "Dízimos", type: "receita", analytic: true },
  { id: "al", code: "5.1.02", name: "Aluguel", type: "despesa", analytic: true },
];
const L = [
  { account_id: "cx", debit: 1000, credit: 0, date: "2026-01-10" },
  { account_id: "dz", debit: 0, credit: 1000, date: "2026-01-10" },
  { account_id: "al", debit: 300, credit: 0, date: "2026-02-05" },
  { account_id: "cx", debit: 0, credit: 300, date: "2026-02-05" },
];
describe("relatórios", () => {
  it("balancete fecha débitos = créditos e carrega saldo anterior", () => {
    const tb = trialBalance(A, L, "2026-02-01", "2026-02-28");
    expect(tb.totalDebit).toBe(300);
    expect(tb.totalCredit).toBe(300);
    const cx = tb.rows.find((r) => r.account.id === "cx")!;
    expect(cx.opening).toBe(1000);
    expect(cx.closing).toBe(700);
  });
  it("DRE apura superávit = receitas - despesas", () => {
    const r = income(A, L, "2026-01-01", "2026-02-28");
    expect(r.totalReceitas).toBe(1000);
    expect(r.totalDespesas).toBe(300);
    expect(r.resultado).toBe(700);
  });
});
