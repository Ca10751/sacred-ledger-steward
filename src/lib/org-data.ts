import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Acc } from "./reports";

export function useOrg(orgId: string) {
  return useQuery({ queryKey: ["org", orgId], queryFn: async () => {
    const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (error) throw error; return data;
  }});
}
export function useMyRole(orgId: string) {
  return useQuery({ queryKey: ["role", orgId], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", u.user!.id).maybeSingle();
    return (data?.role ?? "leitor") as "admin" | "contador" | "leitor";
  }});
}
export function useAccounts(orgId: string) {
  return useQuery({ queryKey: ["accounts", orgId], queryFn: async () => {
    const { data, error } = await supabase.from("accounts").select("*").eq("org_id", orgId);
    if (error) throw error;
    return (data as Acc[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }});
}
export function useCostCenters(orgId: string) {
  return useQuery({ queryKey: ["cc", orgId], queryFn: async () => {
    const { data, error } = await supabase.from("cost_centers").select("*").eq("org_id", orgId).order("code");
    if (error) throw error; return data;
  }});
}
export function useCongregations(orgId: string) {
  return useQuery({ queryKey: ["cong", orgId], queryFn: async () => {
    const { data, error } = await supabase.from("congregations").select("*").eq("org_id", orgId).order("name");
    if (error) throw error; return data;
  }});
}
/** All lines up to `to` (needed for opening balances). */
export function useLines(orgId: string, to: string) {
  return useQuery({ queryKey: ["lines", orgId, to], queryFn: async () => {
    const out: any[] = []; let from = 0;
    for (;;) {
      const { data, error } = await supabase.from("journal_lines")
        .select("account_id,debit,credit,congregation_id,cost_center_id,journal_entries!inner(entry_date)")
        .eq("org_id", orgId).lte("journal_entries.entry_date", to).range(from, from + 999);
      if (error) throw error;
      out.push(...data); if (data.length < 1000) break; from += 1000;
    }
    return out.map((l) => ({ account_id: l.account_id, debit: +l.debit, credit: +l.credit, congregation_id: l.congregation_id, cost_center_id: l.cost_center_id, date: l.journal_entries.entry_date as string }));
  }});
}
