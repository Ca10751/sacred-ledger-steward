import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/reports";
import { useAccounts, useCongregations, useCostCenters, useOrg } from "@/lib/org-data";

type L = { account_id: string; cost_center_id: string; congregation_id: string; debit: string; credit: string; memo: string };
const blank = (): L => ({ account_id: "", cost_center_id: "", congregation_id: "", debit: "", credit: "", memo: "" });
const sel = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

export function EntryForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const { data: org } = useOrg(orgId);
  const { data: accounts = [] } = useAccounts(orgId);
  const { data: ccs = [] } = useCostCenters(orgId);
  const { data: congs = [] } = useCongregations(orgId);
  const isChurch = org?.type === "igreja";
  const [mode, setMode] = useState<"dobrada" | "simples">("dobrada");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState(""); const [doc, setDoc] = useState("");
  const [lines, setLines] = useState<L[]>([blank(), blank()]);
  const [simpleNature, setSimpleNature] = useState<"D" | "C">("C");
  const [busy, setBusy] = useState(false);
  const analytic = accounts.filter((a) => a.analytic);
  const td = lines.reduce((s, l) => s + (+l.debit || 0), 0), tc = lines.reduce((s, l) => s + (+l.credit || 0), 0);
  const diff = Math.round((td - tc) * 100) / 100;
  const upd = (i: number, k: keyof L, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let payload: L[];
    if (mode === "simples") {
      const l = lines[0]; const v = l.debit || l.credit;
      payload = [{ ...l, debit: simpleNature === "D" ? v : "0", credit: simpleNature === "C" ? v : "0" }];
    } else payload = lines.filter((l) => l.account_id && (+l.debit || +l.credit));
    if (payload.some((l) => !l.account_id)) return toast.error("Selecione a conta");
    if (mode === "dobrada" && diff !== 0) return toast.error("Débitos e créditos devem ser iguais");
    setBusy(true);
    const { error } = await supabase.rpc("create_journal_entry", {
      _org: orgId, _date: date, _description: desc, _document: doc, _mode: mode,
      _lines: payload.map((l) => ({ ...l, debit: +l.debit || 0, credit: +l.credit || 0 })),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Lançamento registrado"); onDone();
  }

  const ExtraSelects = ({ l, i }: { l: L; i: number }) => (
    <>
      <select className={sel} value={l.cost_center_id} onChange={(e) => upd(i, "cost_center_id", e.target.value)}>
        <option value="">Centro de custo</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
      </select>
      {isChurch && <select className={sel} value={l.congregation_id} onChange={(e) => upd(i, "congregation_id", e.target.value)}>
        <option value="">Congregação</option>{congs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>}
    </>
  );
  const AccSelect = ({ l, i }: { l: L; i: number }) => (
    <select className={sel} value={l.account_id} onChange={(e) => upd(i, "account_id", e.target.value)} required>
      <option value="">Conta…</option>{analytic.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
    </select>
  );

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="inline-flex rounded-md border bg-muted p-0.5 text-sm">
        {(["dobrada", "simples"] as const).map((m) => (
          <button type="button" key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1.5 ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}>
            {m === "dobrada" ? "Partida dobrada" : "Partida simples"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr_160px]">
        <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label>Histórico</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Pagamento de aluguel ref. março" required /></div>
        <div className="space-y-1.5"><Label>Documento</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="NF, recibo…" /></div>
      </div>

      {mode === "simples" ? (
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <AccSelect l={lines[0]} i={0} />
          <div className="flex gap-2">
            <select className={sel + " w-32"} value={simpleNature} onChange={(e) => setSimpleNature(e.target.value as "D" | "C")}>
              <option value="D">Débito</option><option value="C">Crédito</option>
            </select>
            <Input type="number" step="0.01" min="0" placeholder="Valor" className="num" value={lines[0].debit || lines[0].credit} onChange={(e) => { upd(0, "debit", e.target.value); upd(0, "credit", ""); }} required />
          </div>
          <ExtraSelects l={lines[0]} i={0} />
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <AccSelect l={l} i={i} />
              <Input type="number" step="0.01" min="0" placeholder="Débito" className="num" value={l.debit} onChange={(e) => upd(i, "debit", e.target.value)} disabled={!!+l.credit} />
              <Input type="number" step="0.01" min="0" placeholder="Crédito" className="num" value={l.credit} onChange={(e) => upd(i, "credit", e.target.value)} disabled={!!+l.debit} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length <= 2} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
              <div className="grid gap-2 sm:col-span-4 sm:grid-cols-2"><ExtraSelects l={l} i={i} /></div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="mr-1 h-4 w-4" />Linha</Button>
            <div className="num flex gap-4">
              <span>D {brl(td)}</span><span>C {brl(tc)}</span>
              <span className={diff === 0 ? "text-success" : "text-destructive"}>{diff === 0 ? "Balanceado" : `Diferença ${brl(diff)}`}</span>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-end"><Button disabled={busy}>Salvar lançamento</Button></div>
    </form>
  );
}
