import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LockKeyhole, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useLines, useMyRole, useOrg } from "@/lib/org-data";
import { brl, income } from "@/lib/reports";

export const Route=createFileRoute("/_authenticated/o/$orgId/encerramento")({component:Encerramento});
function Encerramento(){
 const {orgId}=Route.useParams();const qc=useQueryClient();const {data:org}=useOrg(orgId);const {data:role}=useMyRole(orgId);const canWrite=role==="admin"||role==="contador";
 const [year,setYear]=useState(new Date().getFullYear()-1);const [target,setTarget]=useState("");const [notes,setNotes]=useState("");
 const from=`${year}-01-01`,to=`${year}-12-31`;const {data:accounts=[]}=useAccounts(orgId);const {data:lines=[]}=useLines(orgId,to);
 const {data:closing}=useQuery({queryKey:["fiscal-year-closing",orgId,year],queryFn:async()=>{const {data,error}=await supabase.from("fiscal_year_closings").select("*").eq("org_id",orgId).eq("fiscal_year",year).maybeSingle();if(error)throw error;return data;}});
 const result=income(accounts,lines,from,to);const equityAccounts=accounts.filter(a=>a.type==="patrimonio"&&a.analytic);
 async function close(){if(!target){toast.error("Selecione a conta de destinação do patrimônio líquido.");return;}if(!confirm(`Confirmar encerramento do exercício ${year}? Serão gerados lançamentos para zerar receitas e despesas e transferir o resultado. Esta operação é auditável e não pode ser duplicada.`))return;const {data,error}=await supabase.rpc("close_fiscal_year",{_org:orgId,_year:year,_profit_loss_account_id:target,_notes:notes||null});if(error){toast.error(error.message);return;}toast.success("Exercício encerrado com sucesso.");qc.invalidateQueries({queryKey:["fiscal-year-closing",orgId,year]});qc.invalidateQueries({queryKey:["lines",orgId]});qc.invalidateQueries({queryKey:["entries",orgId]});}
 return <div className="space-y-5"><PageHeader title="Encerramento do exercício" subtitle="Apuração do resultado anual e transferência para o patrimônio líquido, com registro contábil e trilha de auditoria."/>
 <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label>Exercício</Label><Input type="number" min="2000" max={new Date().getFullYear()} value={year} onChange={e=>setYear(Number(e.target.value)||year)}/></div><div className="text-sm text-muted-foreground">Organização: {org?.name}</div></div>
 {closing?<div className="rounded-xl border p-5"><div className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="h-5 w-5"/>Exercício encerrado</div><p className="mt-2 text-sm">Encerramento de {year} já registrado. O histórico é somente consulta.</p><p className="mt-1 text-xs text-muted-foreground">Data: {new Date(closing.closed_at).toLocaleString("pt-BR")} · Registro: {closing.id}</p></div>:<>
 <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Receitas do exercício</div><div className="num mt-2 text-2xl font-semibold">{brl(result.totalReceitas)}</div></div><div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Despesas do exercício</div><div className="num mt-2 text-2xl font-semibold">{brl(result.totalDespesas)}</div></div><div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{result.resultado>=0?"Superávit":"Déficit"} a transferir</div><div className={`num mt-2 text-2xl font-semibold ${result.resultado>=0?"text-success":"text-destructive"}`}>{brl(result.resultado)}</div></div></div>
 <div className="rounded-xl border bg-card p-5 space-y-3"><div><h2 className="font-semibold">Conta de destinação</h2><p className="text-xs text-muted-foreground">Selecione a conta de patrimônio líquido que receberá o resultado do exercício.</p></div><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Selecione a conta de patrimônio</option>{equityAccounts.map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select><div className="space-y-1"><Label>Observações (opcional)</Label><Input value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500}/></div><div className="flex justify-end"><Button disabled={!canWrite||!target||year>=new Date().getFullYear()} onClick={close}><LockKeyhole className="mr-2 h-4 w-4"/>Confirmar encerramento</Button></div>{year>=new Date().getFullYear()&&<p className="text-xs text-muted-foreground">O encerramento só pode ser solicitado para exercício anterior ao ano corrente.</p>}</div></>}
 <p className="text-xs text-muted-foreground">Antes de confirmar, confira conciliações bancárias, lançamentos pendentes e saldos das contas. O procedimento depende da função transacional do banco e não deve ser substituído por lançamentos manuais.</p></div>;
}
