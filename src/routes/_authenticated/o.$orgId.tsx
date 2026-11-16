import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, BookOpen, Church, LayoutDashboard, ListTree, Menu, Users, ArrowLeftRight, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-data";

export const Route = createFileRoute("/_authenticated/o/$orgId")({ component: OrgLayout });

function Nav({ orgId, isChurch, onNav }: { orgId: string; isChurch: boolean; onNav?: () => void }) {
  const items = [
    { to: "/o/$orgId", label: "Visão geral", icon: LayoutDashboard, exact: true },
    { to: "/o/$orgId/lancamentos", label: "Lançamentos", icon: BookOpen },
    { to: "/o/$orgId/contas", label: "Plano de contas", icon: ListTree },
    { to: "/o/$orgId/relatorios", label: "Relatórios", icon: BarChart3 },
    ...(isChurch ? [{ to: "/o/$orgId/igreja", label: "Igreja", icon: Church }] : []),
    { to: "/o/$orgId/membros", label: "Usuários", icon: Users },
  ] as const;
  return (
    <nav className="flex flex-col gap-1">
      {items.map((i) => (
        <Link key={i.to} to={i.to} params={{ orgId }} onClick={onNav} activeOptions={{ exact: "exact" in i }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}>
          <i.icon className="h-4 w-4" />{i.label}
        </Link>
      ))}
    </nav>
  );
}

function SideContent({ orgId, onNav }: { orgId: string; onNav?: () => void }) {
  const { data: org } = useOrg(orgId);
  return (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-6 flex items-center gap-2 px-2 font-semibold text-sidebar-accent-foreground"><span className="grid h-7 w-7 place-items-center rounded bg-sidebar-accent text-sm">E</span>Escritura</div>
      <div className="mb-5 rounded-md border border-sidebar-border px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">{org?.type === "igreja" ? "Igreja" : "Empresa"}</div>
        <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{org?.name ?? "…"}</div>
        <Link to="/empresas" className="mt-1.5 inline-flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"><ArrowLeftRight className="h-3 w-3" />Trocar organização</Link>
      </div>
      <Nav orgId={orgId} isChurch={org?.type === "igreja"} onNav={onNav} />
      <button onClick={() => supabase.auth.signOut()} className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" />Sair</button>
    </div>
  );
}

function OrgLayout() {
  const { orgId } = Route.useParams();
  const [open, setOpen] = useState(false);
  const { data: org } = useOrg(orgId);
  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block"><SideContent orgId={orgId} /></aside>
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="rounded-md p-1.5 hover:bg-muted" aria-label="Menu"><Menu className="h-5 w-5" /></SheetTrigger>
          <SheetContent side="left" className="w-64 border-0 p-0"><SideContent orgId={orgId} onNav={() => setOpen(false)} /></SheetContent>
        </Sheet>
        <span className="truncate font-medium">{org?.name}</span>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8"><Outlet /></main>
    </div>
  );
}
