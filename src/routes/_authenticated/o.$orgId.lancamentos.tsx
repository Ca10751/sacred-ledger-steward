import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, PeriodPicker } from "@/components/app/PageHeader";
import { EntryForm } from "@/components/app/EntryForm";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/org-data";
import { brl, fmtDate, monthRange } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/o/$orgId/lancamentos")({ component: Lancamentos });

function Lancamentos() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const { data: role } = useMyRole(orgId);
  const canWrite = role === "admin" || role === "contador";
  const [{ from, to }, setP] = useState(monthRange());
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["entries", orgId, from, to], queryFn: async () => {
    const { data, error } = await supabase.from("journal_entries")
      .select("*, journal_lines(id,debit,credit,memo,accounts(code,name),cost_centers(name),congregations(name))")
      .eq("org_id", orgId).gte("entry_date", from).lte("entry_date", to)
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error; return data;
  }});
  const refresh = () => { qc.invalidateQueries({ queryKey: ["entries", orgId] }); qc.invalidateQueries({ queryKey: ["lines", orgId] }); qc.invalidateQueries({ queryKey: ["recent", orgId] }); };
  async function reverseEntry() {
    if (!reversalTarget?.id || reversalReason.trim().length < 8) {
      toast.error("Informe uma justificativa com pelo menos 8 caracteres.");
      return;
    }
    const { data, error } = await supabase.rpc("reverse_journal_entry", {
      _org: orgId, _entry_id: reversalTarget.id, _reason: reversalReason.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Estorno registrado. O lançamento original foi preservado.");
    setReversalTarget(null); setReversalReason(""); refresh();
    qc.invalidateQueries({ queryKey: ["contribs", orgId] });
  }
  const list = data.filter((e: any) => !q || e.description.toLowerCase().includes(q.toLowerCase()) || (e.document ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Lançamentos contábeis" subtitle="Livro diário da organização" actions={canWrite && <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Novo lançamento</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PeriodPicker from={from} to={to} onChange={(f, t) => setP({ from: f, to: t })} />
        <Input placeholder="Buscar histórico ou documento…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : list.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nenhum lançamento no período.</div>
      ) : (
        <div className="space-y-3">
          {list.map((e: any) => {
            const total = Math.max(e.journal_lines.reduce((s: number, l: any) => s + +l.debit, 0), e.journal_lines.reduce((s: number, l: any) => s + +l.credit, 0));
            return (
              <div key={e.id} className="rounded-lg border bg-card">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3">
                  <span className="num text-sm text-muted-foreground">{fmtDate(e.entry_date)}</span>
                  <span className="min-w-0 flex-1 font-medium">{e.description}</span>
                  {e.document && <span className="text-xs text-muted-foreground">Doc. {e.document}</span>}
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{e.mode === "dobrada" ? "Dobrada" : "Simples"}</span>
                  <span className="num font-medium">{brl(total)}</span>
                  {canWrite && <button onClick={() => { setReversalTarget(e); setReversalReason(""); }} className="text-muted-foreground hover:text-destructive" aria-label="Estornar lançamento" title="Estornar lançamento"><RotateCcw className="h-4 w-4" /></button>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {e.journal_lines.map((l: any) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="px-4 py-2 whitespace-nowrap"><span className="num text-muted-foreground">{l.accounts?.code}</span> {l.accounts?.name}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{[l.cost_centers?.name, l.congregations?.name].filter(Boolean).join(" · ")}</td>
                          <td className="num w-32 px-4 py-2 text-right">{+l.debit ? brl(+l.debit) : ""}</td>
                          <td className="num w-32 px-4 py-2 text-right">{+l.credit ? brl(+l.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!reversalTarget} onOpenChange={(v) => { if (!v) { setReversalTarget(null); setReversalReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Estornar lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">O lançamento original não será apagado. Será criado um lançamento inverso, vinculado ao original e registrado na trilha de auditoria.</p>
            {reversalTarget && <div className="rounded-md border bg-muted/30 p-3 text-sm"><div className="font-medium">{reversalTarget.description}</div><div className="text-xs text-muted-foreground">{fmtDate(reversalTarget.entry_date)} · {reversalTarget.id}</div></div>}
            <div className="space-y-1"><label htmlFor="reversal-reason" className="text-sm font-medium">Justificativa obrigatória</label><Input id="reversal-reason" value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} placeholder="Explique por que este lançamento será estornado" maxLength={500} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setReversalTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={reversalReason.trim().length < 8} onClick={reverseEntry}><RotateCcw className="mr-2 h-4 w-4" />Confirmar estorno</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          {open && <EntryForm orgId={orgId} onDone={() => { setOpen(false); refresh(); }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
