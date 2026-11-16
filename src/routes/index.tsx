import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BookOpen, BookOpenCheck, Building2, Church, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Sapucaí Tropicalis — Gestão contábil para empresas e igrejas" },
    { name: "description", content: "Gestão contábil multiempresa com partidas dobradas, DRE, balancete, razonetes e recursos para igrejas." },
    { property: "og:title", content: "Sapucaí Tropicalis — Gestão contábil para empresas e igrejas" },
    { property: "og:description", content: "Lançamentos, DRE, balancete e prestação de contas de igrejas em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/empresas" }); }); }, [nav]);
  const items = [
    { icon: BookOpen, t: "Lançamentos", d: "Partidas dobradas ou simples, com plano de contas e centros de custo." },
    { icon: Scale, t: "Relatórios", d: "DRE, balancete de verificação e razonetes (contas T) em tempo real." },
    { icon: Church, t: "Igrejas", d: "Dízimos, ofertas, congregações e prestação de contas estatutária." },
    { icon: Building2, t: "Multi-empresa", d: "Cada organização vê somente seus próprios dados." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><BookOpenCheck className="h-5 w-5" /></span>Sapucaí Tropicalis</div>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:pt-20">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Gestão contábil e administrativa</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Contabilidade clara para empresas e igrejas.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">Um sistema direto e rápido: lance, confira e preste contas sem complicação.</p>
        <div className="mt-8 flex gap-3"><Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button></div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <div key={i.t} className="rounded-lg border bg-card p-5">
              <i.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{i.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
