import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, useOrg } from "@/lib/org-data";

export const Route = createFileRoute("/_authenticated/o/$orgId/cadastro-membros")({ component: ChurchMembers });
type Member = { id: string; registration_number: string | null; full_name: string; cpf: string | null; birth_date: string | null; phone: string | null; email: string | null; address: string | null; joined_at: string | null; status: string; notes: string | null };
const blank = { registration_number: "", full_name: "", cpf: "", birth_date: "", phone: "", email: "", address: "", joined_at: new Date().toISOString().slice(0,10), status: "ativo", notes: "" };

function ChurchMembers() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const { data: org } = useOrg(orgId);
  const { data: role } = useMyRole(orgId);
  const canWrite = role === "admin" || role === "contador";
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["church-members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("church_members").select("*").eq("org_id", orgId).order("full_name");
      if (error) throw error; return (data ?? []) as Member[];
    },
  });
  const filtered = useMemo(() => members.filter(m => [m.full_name,m.registration_number,m.phone].some(v => (v ?? "").toLowerCase().includes(search.toLowerCase()))), [members,search]);
  const chosen = members.filter(m => selected.includes(m.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    const payload = { ...form, org_id: orgId, registration_number: form.registration_number || null, cpf: form.cpf || null, birth_date: form.birth_date || null, phone: form.phone || null, email: form.email || null, address: form.address || null, joined_at: form.joined_at || null, notes: form.notes || null };
    const result = editing
      ? await supabase.from("church_members").update(payload).eq("id", editing).eq("org_id", orgId)
      : await supabase.from("church_members").insert(payload);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(editing ? "Cadastro atualizado" : "Membro cadastrado");
    setForm(blank); setEditing(null); qc.invalidateQueries({ queryKey: ["church-members", orgId] });
  }
  function edit(m: Member) {
    setEditing(m.id);
    setForm({ registration_number:m.registration_number ?? "", full_name:m.full_name, cpf:m.cpf ?? "", birth_date:m.birth_date ?? "", phone:m.phone ?? "", email:m.email ?? "", address:m.address ?? "", joined_at:m.joined_at ?? "", status:m.status, notes:m.notes ?? "" });
  }
  async function deactivate(m: Member) {
    if (!confirm("Inativar este membro? O histórico de contribuições será preservado.")) return;
    const { error } = await supabase.from("church_members").update({ status:"inativo" }).eq("id",m.id).eq("org_id",orgId);
    if (error) toast.error(error.message); else { toast.success("Membro inativado"); qc.invalidateQueries({ queryKey:["church-members",orgId] }); }
  }
  return <>
    <PageHeader title="Cadastro de membros" subtitle="Cadastro da comunidade, matrículas e carteirinhas ID-1 (85,6 × 54 mm)." actions={<Button variant="outline" onClick={() => window.print()} disabled={!chosen.length}><Printer className="mr-2 h-4 w-4"/>Imprimir selecionadas ({chosen.length})</Button>} />
    <div className="no-print space-y-4">
      {canWrite && <form onSubmit={save} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><h2 className="font-semibold">{editing ? "Editar membro" : "Novo membro"}</h2><p className="text-xs text-muted-foreground">CPF é opcional e não aparece na carteirinha.</p></div>
        <div className="space-y-1"><Label>Matrícula</Label><Input value={form.registration_number} onChange={e=>setForm({...form,registration_number:e.target.value})}/></div>
        <div className="space-y-1"><Label>Nome completo *</Label><Input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div>
        <div className="space-y-1"><Label>CPF</Label><Input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} placeholder="Opcional"/></div>
        <div className="space-y-1"><Label>Nascimento</Label><Input type="date" value={form.birth_date} onChange={e=>setForm({...form,birth_date:e.target.value})}/></div>
        <div className="space-y-1"><Label>Telefone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
        <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
        <div className="space-y-1"><Label>Endereço</Label><Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div>
        <div className="space-y-1"><Label>Data de ingresso</Label><Input type="date" value={form.joined_at} onChange={e=>setForm({...form,joined_at:e.target.value})}/></div>
        <div className="space-y-1"><Label>Status</Label><select className="h-9 rounded-md border bg-background px-2 text-sm" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></div>
        <div className="sm:col-span-2 space-y-1"><Label>Observações</Label><Input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        <div className="flex items-end gap-2"><Button type="submit"><Plus className="mr-2 h-4 w-4"/>{editing ? "Salvar alterações" : "Cadastrar membro"}</Button>{editing && <Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm(blank)}}><X className="mr-1 h-4 w-4"/>Cancelar</Button>}</div>
      </form>}
      <div className="flex flex-wrap gap-2"><Input className="max-w-sm" placeholder="Buscar por nome, matrícula ou telefone…" value={search} onChange={e=>setSearch(e.target.value)}/><Button size="sm" variant="outline" onClick={()=>setSelected(filtered.map(m=>m.id))}>Selecionar filtrados</Button><Button size="sm" variant="ghost" onClick={()=>setSelected([])}>Limpar seleção</Button></div>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Imprimir</th><th className="p-3">Matrícula</th><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>
      {isLoading && <tr><td colSpan={6} className="p-6 text-center">Carregando…</td></tr>}
      {filtered.map(m=><tr key={m.id} className="border-t"><td className="p-3"><input type="checkbox" checked={selected.includes(m.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,m.id]:old.filter(x=>x!==m.id))}/></td><td className="p-3">{m.registration_number ?? "—"}</td><td className="p-3 font-medium">{m.full_name}</td><td className="p-3">{m.phone ?? "—"}</td><td className="p-3">{m.status}</td><td className="p-3"><div className="flex gap-2">{canWrite && <><button title="Editar" onClick={()=>edit(m)}><Pencil className="h-4 w-4"/></button>{m.status==="ativo" && <button className="text-destructive text-xs" onClick={()=>deactivate(m)}>Inativar</button>}</>}</div></td></tr>)}
      {!isLoading && filtered.length===0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum membro encontrado.</td></tr>}
      </tbody></table></div>
    </div>
    <section className="member-cards hidden print:grid">
      {chosen.map(m=><div key={m.id} className="member-card-pair">
        <div className="member-card"><div className="text-[9px] font-bold uppercase tracking-widest">{org?.name ?? "Igreja"}</div><div className="mt-3 text-lg font-bold">{m.full_name}</div><div className="mt-2 text-xs">Matrícula: {m.registration_number ?? "—"}</div><div className="mt-1 text-[10px]">Membro desde: {m.joined_at ?? "—"}</div><div className="mt-3 text-[8px] uppercase">Carteirinha de identificação</div></div>
        <div className="member-card"><div className="text-[9px] font-bold uppercase tracking-widest">Identificação institucional</div><div className="mt-3 text-xs">{org?.legal_name ?? org?.name}</div><div className="mt-1 text-[10px]">CNPJ: {org?.cnpj ?? "Não informado"}</div><div className="mt-1 text-[10px]">{[org?.address_street,org?.address_number,org?.address_city,org?.address_state].filter(Boolean).join(", ")}</div><div className="mt-4 text-[9px]">Apresente esta identificação quando solicitado.</div></div>
      </div>)}
    </section>
    <style>{`
      @media print { @page { size: A4; margin: 12mm; } body * { visibility:hidden; } .member-cards,.member-cards * { visibility:visible; } .member-cards { display:grid !important; gap:8mm; position:absolute; inset:0; padding:12mm; } .member-card-pair { display:flex; gap:4mm; break-inside:avoid; } .member-card { width:85.6mm; height:54mm; border:0.35mm solid #333; border-radius:3mm; padding:5mm; box-sizing:border-box; overflow:hidden; } }
    `}</style>
  </>;
}
