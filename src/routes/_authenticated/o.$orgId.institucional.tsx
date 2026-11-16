import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, useOrg } from "@/lib/org-data";

export const Route=createFileRoute("/_authenticated/o/$orgId/institucional")({component:Institucional});
const empty={legal_name:"",cnpj:"",address_street:"",address_number:"",address_complement:"",address_district:"",address_city:"",address_state:"",address_postal_code:"",legal_representative_name:"",accountant_name:"",accountant_crc:""};
function Institucional(){
 const {orgId}=Route.useParams();const qc=useQueryClient();const db=supabase as any;const {data:org}=useOrg(orgId);const {data:role}=useMyRole(orgId);const isAdmin=role==="admin";const [form,setForm]=useState(empty);
 useEffect(()=>{if(org)setForm(Object.fromEntries(Object.keys(empty).map(k=>[k,(org as any)[k]??""])) as typeof empty)},[org]);
 async function save(e:React.FormEvent){e.preventDefault();if(!isAdmin){toast.error("Somente administradores podem alterar os dados oficiais.");return;}const {error}=await db.from("organizations").update(form).eq("id",orgId);if(error){toast.error(error.message);return;}qc.invalidateQueries({queryKey:["org",orgId]});toast.success("Dados institucionais atualizados");}
 const fields:[keyof typeof empty,string][]=[["legal_name","Razão social / nome oficial"],["cnpj","CNPJ"],["address_street","Logradouro"],["address_number","Número"],["address_complement","Complemento"],["address_district","Bairro"],["address_city","Cidade"],["address_state","UF"],["address_postal_code","CEP"],["legal_representative_name","Presidente / representante legal"],["accountant_name","Contador responsável"],["accountant_crc","CRC do contador"]];
 return <div className="space-y-5"><PageHeader title="Dados oficiais da organização" subtitle="Informações institucionais usadas nos relatórios, demonstrativos e carteirinhas."/><form onSubmit={save} className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key,label])=><div key={key} className="space-y-1"><Label htmlFor={key}>{label}</Label><Input id={key} value={form[key]} disabled={!isAdmin} maxLength={key==="cnpj"?18: key==="address_state"?2: key==="address_postal_code"?9:160} onChange={e=>setForm({...form,[key]:e.target.value})}/></div>)}<div className="sm:col-span-2 lg:col-span-3 flex justify-end">{isAdmin&&<Button><Save className="mr-2 h-4 w-4"/>Salvar dados oficiais</Button>}</div></form><p className="text-xs text-muted-foreground">Os dados são opcionais e não serão inventados. Assinaturas nos relatórios são campos para assinatura manual; o sistema não declara possuir assinatura digital ou certificação.</p></div>;
}
