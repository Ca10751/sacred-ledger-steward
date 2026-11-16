
CREATE TYPE public.org_type AS ENUM ('empresa','igreja');
CREATE TYPE public.org_role AS ENUM ('admin','contador','leitor');
CREATE TYPE public.account_type AS ENUM ('ativo','passivo','patrimonio','receita','despesa');
CREATE TYPE public.entry_mode AS ENUM ('dobrada','simples');
CREATE TYPE public.contribution_kind AS ENUM ('dizimo','oferta','missoes','outro');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.org_type NOT NULL DEFAULT 'empresa',
  document text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'leitor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.org_role_of(_org uuid)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members WHERE org_id = _org AND user_id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.is_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org AND user_id = auth.uid() AND role IN ('admin','contador'))
$$;
CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = _org AND user_id = auth.uid() AND role = 'admin')
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = profiles.id AND public.is_member(m.org_id))
);
CREATE POLICY "own profile write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "members read org" ON public.organizations FOR SELECT TO authenticated USING (public.is_member(id) OR created_by = auth.uid());
CREATE POLICY "create org" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "admin update org" ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(id));
CREATE POLICY "admin delete org" ON public.organizations FOR DELETE TO authenticated USING (public.is_org_admin(id));

CREATE POLICY "members read members" ON public.organization_members FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "admin manage members" ON public.organization_members FOR UPDATE TO authenticated USING (public.is_org_admin(org_id));
CREATE POLICY "admin delete members" ON public.organization_members FOR DELETE TO authenticated USING (public.is_org_admin(org_id) AND user_id <> auth.uid());

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type public.account_type NOT NULL,
  analytic boolean NOT NULL DEFAULT true,
  church_kind public.contribution_kind,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);
CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);
CREATE TABLE public.congregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  leader text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  document text,
  mode public.entry_mode NOT NULL DEFAULT 'dobrada',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  congregation_id uuid REFERENCES public.congregations(id),
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text
);
CREATE INDEX ON public.journal_lines (org_id, account_id);
CREATE INDEX ON public.journal_entries (org_id, entry_date);

CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  kind public.contribution_kind NOT NULL,
  contributor text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  contribution_date date NOT NULL DEFAULT current_date,
  congregation_id uuid REFERENCES public.congregations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','cost_centers','congregations','journal_entries','journal_lines','contributions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_member(org_id))', t);
    EXECUTE format('CREATE POLICY "writers insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id))', t);
    EXECUTE format('CREATE POLICY "writers update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write(org_id))', t);
    EXECUTE format('CREATE POLICY "writers delete" ON public.%I FOR DELETE TO authenticated USING (public.can_write(org_id))', t);
  END LOOP;
END $$;

-- profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- creator becomes admin + default chart
CREATE OR REPLACE FUNCTION public.handle_new_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'admin');
  INSERT INTO public.accounts (org_id, code, name, type, analytic) VALUES
    (NEW.id,'1','ATIVO','ativo',false),
    (NEW.id,'1.1','Ativo Circulante','ativo',false),
    (NEW.id,'1.1.01','Caixa','ativo',true),
    (NEW.id,'1.1.02','Bancos Conta Movimento','ativo',true),
    (NEW.id,'1.2','Ativo Não Circulante','ativo',false),
    (NEW.id,'1.2.01','Imobilizado','ativo',true),
    (NEW.id,'2','PASSIVO','passivo',false),
    (NEW.id,'2.1.01','Fornecedores','passivo',true),
    (NEW.id,'2.1.02','Obrigações Trabalhistas','passivo',true),
    (NEW.id,'2.1.03','Obrigações Tributárias','passivo',true),
    (NEW.id,'3','PATRIMÔNIO LÍQUIDO','patrimonio',false),
    (NEW.id,'3.1.01', CASE WHEN NEW.type='igreja' THEN 'Patrimônio Social' ELSE 'Capital Social' END,'patrimonio',true),
    (NEW.id,'3.1.02', CASE WHEN NEW.type='igreja' THEN 'Superávits/Déficits Acumulados' ELSE 'Lucros/Prejuízos Acumulados' END,'patrimonio',true),
    (NEW.id,'4','RECEITAS','receita',false),
    (NEW.id,'5','DESPESAS','despesa',false),
    (NEW.id,'5.1.01','Salários e Encargos','despesa',true),
    (NEW.id,'5.1.02','Aluguel','despesa',true),
    (NEW.id,'5.1.03','Energia, Água e Telefone','despesa',true),
    (NEW.id,'5.1.04','Material de Consumo','despesa',true),
    (NEW.id,'5.1.05','Despesas Bancárias','despesa',true);
  IF NEW.type = 'igreja' THEN
    INSERT INTO public.accounts (org_id, code, name, type, analytic, church_kind) VALUES
      (NEW.id,'4.1.01','Dízimos','receita',true,'dizimo'),
      (NEW.id,'4.1.02','Ofertas','receita',true,'oferta'),
      (NEW.id,'4.1.03','Ofertas Missionárias','receita',true,'missoes'),
      (NEW.id,'4.1.04','Outras Receitas','receita',true,'outro'),
      (NEW.id,'5.2.01','Prebenda Pastoral','despesa',true,NULL),
      (NEW.id,'5.2.02','Ação Social','despesa',true,NULL),
      (NEW.id,'5.2.03','Repasses Missionários','despesa',true,NULL);
    INSERT INTO public.congregations (org_id, name) VALUES (NEW.id,'Sede');
  ELSE
    INSERT INTO public.accounts (org_id, code, name, type, analytic) VALUES
      (NEW.id,'4.1.01','Receita de Vendas','receita',true),
      (NEW.id,'4.1.02','Receita de Serviços','receita',true),
      (NEW.id,'4.2.01','(-) Deduções e Impostos sobre Vendas','receita',true),
      (NEW.id,'5.3.01','Custo das Mercadorias Vendidas','despesa',true);
  END IF;
  INSERT INTO public.cost_centers (org_id, code, name) VALUES (NEW.id,'01','Administrativo');
  RETURN NEW;
END $$;
CREATE TRIGGER on_org_created AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.handle_new_org();

-- atomic entry creation with validation
CREATE OR REPLACE FUNCTION public.create_journal_entry(_org uuid, _date date, _description text, _document text, _mode public.entry_mode, _lines jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _id uuid; _d numeric := 0; _c numeric := 0; _n int := 0; l jsonb;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão para lançar nesta organização'; END IF;
  IF coalesce(trim(_description),'') = '' THEN RAISE EXCEPTION 'Informe o histórico'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    _d := _d + coalesce((l->>'debit')::numeric,0);
    _c := _c + coalesce((l->>'credit')::numeric,0);
    _n := _n + 1;
  END LOOP;
  IF _n = 0 OR (_d + _c) = 0 THEN RAISE EXCEPTION 'Lançamento sem valores'; END IF;
  IF _mode = 'dobrada' AND (_n < 2 OR _d <> _c) THEN RAISE EXCEPTION 'Partida dobrada exige débitos = créditos (D %, C %)', _d, _c; END IF;
  INSERT INTO public.journal_entries (org_id, entry_date, description, document, mode)
  VALUES (_org, _date, _description, nullif(_document,''), _mode) RETURNING id INTO _id;
  INSERT INTO public.journal_lines (entry_id, org_id, account_id, cost_center_id, congregation_id, debit, credit, memo)
  SELECT _id, _org, (x->>'account_id')::uuid, nullif(x->>'cost_center_id','')::uuid, nullif(x->>'congregation_id','')::uuid,
         coalesce((x->>'debit')::numeric,0), coalesce((x->>'credit')::numeric,0), nullif(x->>'memo','')
  FROM jsonb_array_elements(_lines) x;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_journal_entry TO authenticated;

CREATE OR REPLACE FUNCTION public.add_member_by_email(_org uuid, _email text, _role public.org_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  SELECT id INTO _uid FROM public.profiles WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado. Ele precisa criar uma conta primeiro.'; END IF;
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (_org, _uid, _role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
END $$;
GRANT EXECUTE ON FUNCTION public.add_member_by_email TO authenticated;
