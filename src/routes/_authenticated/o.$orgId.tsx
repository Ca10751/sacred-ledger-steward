import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, BookOpen, BookOpenCheck, Church, LayoutDashboard, ListTree, Menu, Users, ArrowLeftRight, LogOut, Settings2, CalendarDays } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org-data";

export const Route = createFileRoute("/_authenticated/o/$orgId")({ component: OrgLayout });

function Nav({ orgId, isChurch, onNav }: { orgId: string; isChurch: boolean; onNav?: (() => void) | undefined }) {
  const items = [
    { to: "/o/$orgId", label: "Visão geral", icon: LayoutDashboard, exact: true },
    { to: "/o/$orgId/lancamentos", label: "Lançamentos", icon: BookOpen },
    { to: "/o/$orgId/contas", label: "Plano de contas", icon: ListTree },
    { to: "/o/$orgId/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/o/$orgId/orcamento", label: "Planejamento anual", icon: CalendarDays },
    ...(isChurch ? [{ to: "/o/$orgId/igreja", label: "Gestão da igreja", icon: Church }] : []),
    { to: "/o/$orgId/membros", label: "Usuários e acessos", icon: Users },
  ] as const;
  return (
    <nav className="flex flex-col gap-1">
      <div className="mb-2 px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">Workspace</div>
      {items.map((i) => (
        <Link key={i.to} to={i.to} params={{ orgId }} onClick={onNav} activeOptions={{ exact: "exact" in i }}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-semibold shadow-sm" }}>
          <i.icon className="h-[17px] w-[17px] opacity-80 group-hover:opacity-100" />{i.label}
        </Link>
      ))}
    </nav>
  );
}

function SideContent({ orgId, onNav }: { orgId: string; onNav?: (() => void) | undefined }) {
  const { data: org } = useOrg(orgId);
  const isChurch = org?.type === "igreja";
  return (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <div className="mb-7 flex items-center gap-3 px-2 pt-1">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"><BookOpenCheck className="h-5 w-5" /></span>
        <div className="min-w-0"><div className="truncate text-sm font-bold tracking-tight text-sidebar-accent-foreground">Sacred Ledger</div><div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/45">Gestão contábil</div></div>
      </div>
      <div className="mb-5 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/50"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Organização ativa</div>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary/80 text-sidebar-primary-foreground">{isChurch ? <Church className="h-4 w-4" /> : <span className="text-xs font-bold">PJ</span>}</span>
          <div className="min-w-0"><div className="truncate text-sm font-semibold text-sidebar-accent-foreground">{org?.name ?? "Carregando…"}</div><div className="mt-0.5 text-[11px] text-sidebar-foreground/55">{isChurch ? "Organização religiosa" : "Empresa"}</div></div>
        </div>
        <Link to="/empresas" onClick={onNav} className="mt-3 flex items-center gap-1.5 border-t border-sidebar-border pt-3 text-xs text-sidebar-foreground/65 transition hover:text-sidebar-accent-foreground"><ArrowLeftRight className="h-3.5 w-3.5" />Trocar organização</Link>
      </div>
      <Nav orgId={orgId} isChurch={isChurch} onNav={onNav} />
      <div className="mt-auto">
        <div className="mb-3 rounded-lg border border-sidebar-border/70 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-sidebar-accent-foreground"><Settings2 className="h-3.5 w-3.5" />Ambiente seguro</div>
          <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/50">Dados separados por organização e controle de permissões.</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><LogOut className="h-4 w-4" />Sair da conta</button>
        <div className="px-3 pt-3 text-[10px] text-sidebar-foreground/35">Sacred Ledger · versão em desenvolvimento</div>
      </div>
    </div>
  );
}

function OrgLayout() {
  const { orgId } = Route.useParams();
  const [open, setOpen] = useState(false);
  const { data: org } = useOrg(orgId);
  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border lg:block"><SideContent orgId={orgId} /></aside>
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="rounded-lg p-2 transition hover:bg-muted" aria-label="Abrir menu"><Menu className="h-5 w-5" /></SheetTrigger>
          <SheetContent side="left" className="w-64 border-0 p-0"><SideContent orgId={orgId} onNav={() => setOpen(false)} /></SheetContent>
        </Sheet>
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{org?.name}</div><div className="text-[10px] text-muted-foreground">Sacred Ledger</div></div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8 xl:px-9"><Outlet /></main>
    </div>
  );
}
