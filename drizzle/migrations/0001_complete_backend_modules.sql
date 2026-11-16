-- ===== Organizations: dados oficiais
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_name text, ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS address_street text, ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text, ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text, ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_postal_code text, ADD COLUMN IF NOT EXISTS legal_representative_name text,
  ADD COLUMN IF NOT EXISTS accountant_name text, ADD COLUMN IF NOT EXISTS accountant_crc text;

-- ===== Church members
CREATE TABLE public.church_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  registration_number text, full_name text NOT NULL, cpf text, birth_date date,
  phone text, email text, address text, joined_at date,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX church_members_reg_uq ON public.church_members(org_id, registration_number) WHERE registration_number IS NOT NULL;
CREATE UNIQUE INDEX church_members_cpf_uq ON public.church_members(org_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX church_members_org_idx ON public.church_members(org_id, full_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_members TO authenticated;
GRANT ALL ON public.church_members TO service_role;
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.church_members FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.church_members FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id));
CREATE POLICY "writers update" ON public.church_members FOR UPDATE TO authenticated USING (public.can_write(org_id)) WITH CHECK (public.can_write(org_id));
CREATE POLICY "admin delete" ON public.church_members FOR DELETE TO authenticated USING (public.is_org_admin(org_id));

ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.church_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS contributions_org_date_idx ON public.contributions(org_id, contribution_date);
CREATE INDEX IF NOT EXISTS contributions_member_idx ON public.contributions(member_id);

-- ===== Indexes on core tables
CREATE INDEX IF NOT EXISTS journal_entries_org_date_idx ON public.journal_entries(org_id, entry_date);
CREATE INDEX IF NOT EXISTS journal_lines_org_idx ON public.journal_lines(org_id);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON public.journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS accounts_org_idx ON public.accounts(org_id, code);
CREATE INDEX IF NOT EXISTS org_members_user_idx ON public.organization_members(user_id);

-- ===== Fiscal year closings
CREATE TABLE public.fiscal_year_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year int NOT NULL, entry_id uuid REFERENCES public.journal_entries(id),
  profit_loss_account_id uuid REFERENCES public.accounts(id),
  result_amount numeric NOT NULL DEFAULT 0, notes text,
  closed_by uuid NOT NULL DEFAULT auth.uid(), closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, fiscal_year)
);
GRANT SELECT ON public.fiscal_year_closings TO authenticated;
GRANT ALL ON public.fiscal_year_closings TO service_role;
ALTER TABLE public.fiscal_year_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.fiscal_year_closings FOR SELECT TO authenticated USING (public.is_member(org_id));

CREATE OR REPLACE FUNCTION public.is_period_closed(_org uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.fiscal_year_closings WHERE org_id = _org AND fiscal_year >= extract(year FROM _date)::int)
$$;

-- ===== Reversals
CREATE TABLE public.journal_entry_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  original_entry_id uuid NOT NULL UNIQUE REFERENCES public.journal_entries(id),
  reversal_entry_id uuid NOT NULL UNIQUE REFERENCES public.journal_entries(id),
  reason text NOT NULL, reversed_by uuid NOT NULL DEFAULT auth.uid(), reversed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.journal_entry_reversals TO authenticated;
GRANT ALL ON public.journal_entry_reversals TO service_role;
ALTER TABLE public.journal_entry_reversals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.journal_entry_reversals FOR SELECT TO authenticated USING (public.is_member(org_id));

-- ===== Bank
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  bank_name text NOT NULL, branch text, account_number_masked text, account_label text,
  opening_balance numeric NOT NULL DEFAULT 0, opening_date date NOT NULL DEFAULT current_date,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_accounts_org_idx ON public.bank_accounts(org_id);
CREATE TABLE public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date date NOT NULL, opening_balance numeric NOT NULL DEFAULT 0, closing_balance numeric NOT NULL DEFAULT 0,
  import_source text, imported_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_statements_org_idx ON public.bank_statements(org_id, statement_date);
CREATE TABLE public.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  statement_id uuid NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL, description text NOT NULL, amount numeric NOT NULL CHECK (amount >= 0),
  document text, direction text NOT NULL CHECK (direction IN ('debit','credit')),
  line_hash text NOT NULL,
  reconciliation_status text NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending','matched','divergent')),
  journal_line_id uuid UNIQUE REFERENCES public.journal_lines(id),
  reconciled_at timestamptz, reconciled_by uuid,
  UNIQUE (bank_account_id, line_hash)
);
CREATE INDEX bank_statement_lines_org_idx ON public.bank_statement_lines(org_id, reconciliation_status);
CREATE TABLE public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  statement_line_id uuid NOT NULL REFERENCES public.bank_statement_lines(id) ON DELETE CASCADE,
  journal_line_id uuid NOT NULL REFERENCES public.journal_lines(id),
  difference numeric NOT NULL DEFAULT 0, action text NOT NULL DEFAULT 'match',
  performed_by uuid NOT NULL DEFAULT auth.uid(), performed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT SELECT, DELETE ON public.bank_statements, public.bank_statement_lines TO authenticated;
GRANT SELECT ON public.bank_reconciliations TO authenticated;
GRANT ALL ON public.bank_accounts, public.bank_statements, public.bank_statement_lines, public.bank_reconciliations TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.bank_accounts FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.org_id = bank_accounts.org_id));
CREATE POLICY "writers update" ON public.bank_accounts FOR UPDATE TO authenticated USING (public.can_write(org_id)) WITH CHECK (public.can_write(org_id));
CREATE POLICY "admin delete" ON public.bank_accounts FOR DELETE TO authenticated USING (public.is_org_admin(org_id));
CREATE POLICY "members read" ON public.bank_statements FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "admin delete" ON public.bank_statements FOR DELETE TO authenticated USING (public.is_org_admin(org_id));
CREATE POLICY "members read" ON public.bank_statement_lines FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "members read" ON public.bank_reconciliations FOR SELECT TO authenticated USING (public.is_member(org_id));

-- ===== Integrity triggers on journal
CREATE OR REPLACE FUNCTION public.guard_journal_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND public.is_period_closed(OLD.org_id, OLD.entry_date) THEN
    RAISE EXCEPTION 'Exercício encerrado: o lançamento de % não pode ser alterado ou excluído', OLD.entry_date;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.journal_entry_reversals r WHERE r.original_entry_id = OLD.id OR r.reversal_entry_id = OLD.id) THEN
      RAISE EXCEPTION 'Lançamento com estorno vinculado não pode ser excluído';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.entry_date < DATE '1900-01-01' OR NEW.entry_date > current_date + 3650 THEN
    RAISE EXCEPTION 'Data do lançamento inválida';
  END IF;
  IF public.is_period_closed(NEW.org_id, NEW.entry_date) THEN
    RAISE EXCEPTION 'Exercício de % já encerrado: não é possível lançar nesta data', extract(year FROM NEW.entry_date);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.org_id <> OLD.org_id THEN RAISE EXCEPTION 'Não é permitido mudar a organização do lançamento'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_journal_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e record; _r record;
BEGIN
  IF TG_OP = 'DELETE' THEN _r := OLD; ELSE _r := NEW; END IF;
  SELECT org_id, entry_date INTO _e FROM public.journal_entries WHERE id = _r.entry_id;
  IF _e.org_id IS NOT NULL AND TG_OP <> 'INSERT' AND public.is_period_closed(_e.org_id, _e.entry_date) THEN
    RAISE EXCEPTION 'Exercício encerrado: linhas não podem ser alteradas';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.bank_statement_lines WHERE journal_line_id = OLD.id) THEN
      RAISE EXCEPTION 'Linha conciliada com extrato bancário não pode ser excluída';
    END IF;
    RETURN OLD;
  END IF;
  IF _e.org_id IS NULL OR _e.org_id <> NEW.org_id THEN RAISE EXCEPTION 'Linha e lançamento de organizações diferentes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'Conta inexistente ou de outra organização'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND analytic) THEN
    RAISE EXCEPTION 'Lançamentos só podem usar contas analíticas'; END IF;
  IF NEW.cost_center_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE id = NEW.cost_center_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'Centro de custo de outra organização'; END IF;
  IF NEW.congregation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.congregations WHERE id = NEW.congregation_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'Congregação de outra organização'; END IF;
  IF NEW.debit < 0 OR NEW.credit < 0 THEN RAISE EXCEPTION 'Valores negativos não são permitidos'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_journal_entry BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.guard_journal_entry();
CREATE TRIGGER trg_guard_journal_line BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.guard_journal_line();

-- ===== Budget
CREATE TABLE public.annual_budget_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_year int NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2200),
  start_date date, end_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected','closed')),
  notes text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid, approved_at timestamptz, rejected_by uuid, rejected_at timestamptz, rejection_reason text,
  UNIQUE (org_id, fiscal_year)
);
CREATE TABLE public.annual_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.annual_budget_plans(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  congregation_id uuid REFERENCES public.congregations(id) ON DELETE SET NULL,
  description text, monthly_values jsonb NOT NULL DEFAULT '[0,0,0,0,0,0,0,0,0,0,0,0]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX annual_budget_items_budget_idx ON public.annual_budget_items(budget_id);
CREATE TABLE public.annual_budget_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.annual_budget_plans(id) ON DELETE CASCADE,
  action text NOT NULL, details jsonb, performed_by uuid DEFAULT auth.uid(), performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX annual_budget_history_budget_idx ON public.annual_budget_history(budget_id, performed_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_budget_plans, public.annual_budget_items TO authenticated;
GRANT SELECT ON public.annual_budget_history TO authenticated;
GRANT ALL ON public.annual_budget_plans, public.annual_budget_items, public.annual_budget_history TO service_role;
ALTER TABLE public.annual_budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_budget_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.annual_budget_plans FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.annual_budget_plans FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND status = 'draft');
CREATE POLICY "writers update draft" ON public.annual_budget_plans FOR UPDATE TO authenticated USING (public.can_write(org_id) AND status IN ('draft','rejected')) WITH CHECK (public.can_write(org_id) AND status IN ('draft','rejected'));
CREATE POLICY "admin delete draft" ON public.annual_budget_plans FOR DELETE TO authenticated USING (public.is_org_admin(org_id) AND status <> 'approved');
CREATE POLICY "members read" ON public.annual_budget_items FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.annual_budget_items FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.annual_budget_plans p WHERE p.id = budget_id AND p.org_id = annual_budget_items.org_id AND p.status IN ('draft','rejected')));
CREATE POLICY "writers update" ON public.annual_budget_items FOR UPDATE TO authenticated USING (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.annual_budget_plans p WHERE p.id = budget_id AND p.status IN ('draft','rejected'))) WITH CHECK (public.can_write(org_id));
CREATE POLICY "writers delete" ON public.annual_budget_items FOR DELETE TO authenticated USING (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.annual_budget_plans p WHERE p.id = budget_id AND p.status IN ('draft','rejected')));
CREATE POLICY "members read" ON public.annual_budget_history FOR SELECT TO authenticated USING (public.is_member(org_id));

CREATE OR REPLACE FUNCTION public.validate_budget_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(NEW.monthly_values) <> 'array' OR jsonb_array_length(NEW.monthly_values) <> 12 THEN
    RAISE EXCEPTION 'Informe 12 valores mensais'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'Conta de outra organização'; END IF;
  IF NEW.cost_center_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE id = NEW.cost_center_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'Centro de custo de outra organização'; END IF;
  IF NEW.congregation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.congregations WHERE id = NEW.congregation_id AND org_id = NEW.org_id) THEN RAISE EXCEPTION 'Congregação de outra organização'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_budget_item BEFORE INSERT OR UPDATE ON public.annual_budget_items FOR EACH ROW EXECUTE FUNCTION public.validate_budget_item();

CREATE OR REPLACE FUNCTION public.log_budget_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.annual_budget_history (org_id, budget_id, action, details)
  VALUES (NEW.org_id, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status:' || NEW.status ELSE 'plan_updated' END,
    jsonb_build_object('status', NEW.status));
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.log_budget_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.annual_budget_plans WHERE id = OLD.budget_id) THEN
      INSERT INTO public.annual_budget_history (org_id, budget_id, action, details)
      VALUES (OLD.org_id, OLD.budget_id, 'item_delete', jsonb_build_object('item_id', OLD.id, 'account_id', OLD.account_id, 'monthly_values', OLD.monthly_values));
    END IF;
    RETURN OLD;
  END IF;
  INSERT INTO public.annual_budget_history (org_id, budget_id, action, details)
  VALUES (NEW.org_id, NEW.budget_id, 'item_' || lower(TG_OP), jsonb_build_object('item_id', NEW.id, 'account_id', NEW.account_id, 'monthly_values', NEW.monthly_values));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_log_budget_plan AFTER INSERT OR UPDATE ON public.annual_budget_plans FOR EACH ROW EXECUTE FUNCTION public.log_budget_plan_change();
CREATE TRIGGER trg_log_budget_item AFTER INSERT OR UPDATE OR DELETE ON public.annual_budget_items FOR EACH ROW EXECUTE FUNCTION public.log_budget_item_change();

CREATE OR REPLACE FUNCTION public.approve_annual_budget(_org uuid, _budget_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Apenas administradores podem aprovar o orçamento'; END IF;
  SELECT status INTO _s FROM public.annual_budget_plans WHERE id = _budget_id AND org_id = _org FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado nesta organização'; END IF;
  IF _s = 'approved' THEN RAISE EXCEPTION 'Orçamento já aprovado'; END IF;
  IF _s = 'closed' THEN RAISE EXCEPTION 'Orçamento encerrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.annual_budget_items WHERE budget_id = _budget_id) THEN RAISE EXCEPTION 'Inclua ao menos uma categoria antes de aprovar'; END IF;
  UPDATE public.annual_budget_plans SET status = 'approved', approved_by = auth.uid(), approved_at = now() WHERE id = _budget_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_annual_budget(_org uuid, _budget_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text;
BEGIN
  IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Apenas administradores podem reprovar o orçamento'; END IF;
  SELECT status INTO _s FROM public.annual_budget_plans WHERE id = _budget_id AND org_id = _org FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado nesta organização'; END IF;
  IF _s <> 'draft' THEN RAISE EXCEPTION 'Somente rascunhos podem ser reprovados'; END IF;
  UPDATE public.annual_budget_plans SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = nullif(trim(_reason),'') WHERE id = _budget_id;
END $$;

-- ===== Inventory & assets
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku text, description text NOT NULL, category text, unit text NOT NULL DEFAULT 'un',
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_items_sku_uq ON public.inventory_items(org_id, sku) WHERE sku IS NOT NULL AND sku <> '';
CREATE TABLE public.physical_inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  notes text, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid, submitted_at timestamptz, approved_by uuid, approved_at timestamptz
);
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida','transferencia','ajuste')),
  quantity numeric NOT NULL, movement_date date NOT NULL DEFAULT current_date,
  from_congregation_id uuid, to_congregation_id uuid,
  unit_cost numeric CHECK (unit_cost IS NULL OR unit_cost >= 0),
  responsible text, document text, notes text,
  session_id uuid REFERENCES public.physical_inventory_sessions(id),
  created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_from_congregation_id_fkey FOREIGN KEY (from_congregation_id) REFERENCES public.congregations(id),
  CONSTRAINT inventory_movements_to_congregation_id_fkey FOREIGN KEY (to_congregation_id) REFERENCES public.congregations(id)
);
CREATE INDEX inventory_movements_org_idx ON public.inventory_movements(org_id, movement_date);
CREATE INDEX inventory_movements_item_idx ON public.inventory_movements(item_id);
CREATE TABLE public.physical_inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.physical_inventory_sessions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  expected_quantity numeric NOT NULL DEFAULT 0, counted_quantity numeric NOT NULL CHECK (counted_quantity >= 0),
  variance numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, item_id)
);
CREATE TABLE public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_code text NOT NULL, description text NOT NULL, category text,
  acquisition_date date, acquisition_value numeric NOT NULL DEFAULT 0 CHECK (acquisition_value >= 0),
  useful_life_months int CHECK (useful_life_months IS NULL OR useful_life_months > 0),
  residual_value numeric NOT NULL DEFAULT 0 CHECK (residual_value >= 0),
  location text, responsible text, congregation_id uuid REFERENCES public.congregations(id) ON DELETE SET NULL,
  serial_number text, condition text NOT NULL DEFAULT 'bom' CHECK (condition IN ('bom','regular','ruim','manutencao')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','baixado','manutencao','cedido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, asset_code)
);
CREATE INDEX fixed_assets_cong_idx ON public.fixed_assets(org_id, congregation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items, public.fixed_assets, public.physical_inventory_sessions, public.physical_inventory_counts TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_items, public.inventory_movements, public.physical_inventory_sessions, public.physical_inventory_counts, public.fixed_assets TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id));
CREATE POLICY "writers update" ON public.inventory_items FOR UPDATE TO authenticated USING (public.can_write(org_id)) WITH CHECK (public.can_write(org_id));
CREATE POLICY "admin delete" ON public.inventory_items FOR DELETE TO authenticated USING (public.is_org_admin(org_id));
CREATE POLICY "members read" ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "members read" ON public.physical_inventory_sessions FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.physical_inventory_sessions FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND status = 'draft');
CREATE POLICY "writers update draft" ON public.physical_inventory_sessions FOR UPDATE TO authenticated USING (public.can_write(org_id) AND status = 'draft') WITH CHECK (public.can_write(org_id) AND status = 'draft');
CREATE POLICY "admin delete draft" ON public.physical_inventory_sessions FOR DELETE TO authenticated USING (public.is_org_admin(org_id) AND status = 'draft');
CREATE POLICY "members read" ON public.physical_inventory_counts FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.physical_inventory_counts FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.physical_inventory_sessions s WHERE s.id = session_id AND s.org_id = physical_inventory_counts.org_id AND s.status = 'draft') AND EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = item_id AND i.org_id = physical_inventory_counts.org_id));
CREATE POLICY "writers update" ON public.physical_inventory_counts FOR UPDATE TO authenticated USING (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.physical_inventory_sessions s WHERE s.id = session_id AND s.status = 'draft')) WITH CHECK (public.can_write(org_id));
CREATE POLICY "writers delete" ON public.physical_inventory_counts FOR DELETE TO authenticated USING (public.can_write(org_id) AND EXISTS (SELECT 1 FROM public.physical_inventory_sessions s WHERE s.id = session_id AND s.status = 'draft'));
CREATE POLICY "members read" ON public.fixed_assets FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY "writers insert" ON public.fixed_assets FOR INSERT TO authenticated WITH CHECK (public.can_write(org_id) AND (congregation_id IS NULL OR EXISTS (SELECT 1 FROM public.congregations c WHERE c.id = congregation_id AND c.org_id = fixed_assets.org_id)));
CREATE POLICY "writers update" ON public.fixed_assets FOR UPDATE TO authenticated USING (public.can_write(org_id)) WITH CHECK (public.can_write(org_id) AND (congregation_id IS NULL OR EXISTS (SELECT 1 FROM public.congregations c WHERE c.id = congregation_id AND c.org_id = fixed_assets.org_id)));
CREATE POLICY "admin delete" ON public.fixed_assets FOR DELETE TO authenticated USING (public.is_org_admin(org_id));

CREATE OR REPLACE FUNCTION public.inventory_balance(_item uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(sum(CASE movement_type WHEN 'entrada' THEN quantity WHEN 'saida' THEN -quantity WHEN 'ajuste' THEN quantity ELSE 0 END),0)
  FROM public.inventory_movements WHERE item_id = _item
$$;

CREATE OR REPLACE FUNCTION public.record_inventory_movement(_org uuid, _item_id uuid, _movement_type text, _quantity numeric, _movement_date date,
  _from_congregation_id uuid, _to_congregation_id uuid, _unit_cost numeric, _responsible text, _document text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _bal numeric;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão para movimentar estoque nesta organização'; END IF;
  PERFORM 1 FROM public.inventory_items WHERE id = _item_id AND org_id = _org AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material não encontrado nesta organização'; END IF;
  IF _movement_type NOT IN ('entrada','saida','transferencia') THEN RAISE EXCEPTION 'Tipo de movimentação inválido (ajustes só via inventário físico)'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser positiva'; END IF;
  IF _movement_date IS NULL OR _movement_date > current_date THEN RAISE EXCEPTION 'Data inválida (não pode ser futura)'; END IF;
  IF _from_congregation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.congregations WHERE id = _from_congregation_id AND org_id = _org) THEN RAISE EXCEPTION 'Congregação de origem inválida'; END IF;
  IF _to_congregation_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.congregations WHERE id = _to_congregation_id AND org_id = _org) THEN RAISE EXCEPTION 'Congregação de destino inválida'; END IF;
  IF _movement_type = 'transferencia' AND (_from_congregation_id IS NULL OR _to_congregation_id IS NULL OR _from_congregation_id = _to_congregation_id) THEN
    RAISE EXCEPTION 'Transferência exige congregações de origem e destino diferentes'; END IF;
  IF _movement_type = 'saida' THEN
    _bal := public.inventory_balance(_item_id);
    IF _quantity > _bal THEN RAISE EXCEPTION 'Saldo insuficiente: disponível %, solicitado %', _bal, _quantity; END IF;
  END IF;
  INSERT INTO public.inventory_movements (org_id, item_id, movement_type, quantity, movement_date, from_congregation_id, to_congregation_id, unit_cost, responsible, document, notes)
  VALUES (_org, _item_id, _movement_type, _quantity, _movement_date, _from_congregation_id, _to_congregation_id, _unit_cost, nullif(trim(_responsible),''), nullif(trim(_document),''), nullif(trim(_notes),''))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.submit_physical_inventory(_org uuid, _session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text; _missing int;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão nesta organização'; END IF;
  SELECT status INTO _s FROM public.physical_inventory_sessions WHERE id = _session_id AND org_id = _org FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Inventário não encontrado'; END IF;
  IF _s <> 'draft' THEN RAISE EXCEPTION 'Inventário já enviado'; END IF;
  SELECT count(*) INTO _missing FROM public.inventory_items i WHERE i.org_id = _org AND i.active
    AND NOT EXISTS (SELECT 1 FROM public.physical_inventory_counts c WHERE c.session_id = _session_id AND c.item_id = i.id);
  IF _missing > 0 THEN RAISE EXCEPTION 'Faltam % material(is) sem contagem', _missing; END IF;
  UPDATE public.physical_inventory_counts c SET expected_quantity = public.inventory_balance(c.item_id),
    variance = c.counted_quantity - public.inventory_balance(c.item_id) WHERE c.session_id = _session_id;
  UPDATE public.physical_inventory_sessions SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now() WHERE id = _session_id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_physical_inventory(_org uuid, _session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text; _d date;
BEGIN
  IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Apenas administradores aprovam inventários'; END IF;
  SELECT status, reference_date INTO _s, _d FROM public.physical_inventory_sessions WHERE id = _session_id AND org_id = _org FOR UPDATE;
  IF _s IS NULL THEN RAISE EXCEPTION 'Inventário não encontrado'; END IF;
  IF _s <> 'submitted' THEN RAISE EXCEPTION 'Inventário precisa estar enviado (status atual: %)', _s; END IF;
  INSERT INTO public.inventory_movements (org_id, item_id, movement_type, quantity, movement_date, notes, session_id)
  SELECT _org, c.item_id, 'ajuste', c.variance, _d, 'Ajuste de inventário físico', _session_id
  FROM public.physical_inventory_counts c WHERE c.session_id = _session_id AND c.variance <> 0;
  UPDATE public.physical_inventory_sessions SET status = 'approved', approved_by = auth.uid(), approved_at = now() WHERE id = _session_id;
END $$;

-- ===== Accounting RPCs
CREATE OR REPLACE FUNCTION public.create_journal_entry(_org uuid, _date date, _description text, _document text, _mode entry_mode, _lines jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _id uuid; _d numeric := 0; _c numeric := 0; _n int := 0; l jsonb;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão para lançar nesta organização'; END IF;
  IF coalesce(trim(_description),'') = '' THEN RAISE EXCEPTION 'Informe o histórico'; END IF;
  IF _date IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    IF coalesce((l->>'debit')::numeric,0) < 0 OR coalesce((l->>'credit')::numeric,0) < 0 THEN RAISE EXCEPTION 'Valores negativos não são permitidos'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = (l->>'account_id')::uuid AND org_id = _org) THEN RAISE EXCEPTION 'Conta inexistente ou de outra organização'; END IF;
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

CREATE OR REPLACE FUNCTION public.create_contribution(_org uuid, _date date, _kind contribution_kind, _member_id uuid, _contributor text,
  _amount numeric, _congregation_id uuid, _cash_account_id uuid, _revenue_account_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _entry uuid; _id uuid; _name text; _labels jsonb := '{"dizimo":"Dízimo","oferta":"Oferta","missoes":"Oferta missionária","outro":"Contribuição"}';
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão nesta organização'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Valor deve ser positivo'; END IF;
  IF _member_id IS NOT NULL THEN
    SELECT full_name INTO _name FROM public.church_members WHERE id = _member_id AND org_id = _org;
    IF _name IS NULL THEN RAISE EXCEPTION 'Membro não encontrado nesta organização'; END IF;
  END IF;
  _name := coalesce(_name, nullif(trim(_contributor),''));
  _entry := public.create_journal_entry(_org, _date, (_labels->>_kind::text) || coalesce(' — ' || _name, ''), NULL, 'dobrada',
    jsonb_build_array(
      jsonb_build_object('account_id', _cash_account_id, 'debit', _amount, 'credit', 0, 'congregation_id', coalesce(_congregation_id::text,'')),
      jsonb_build_object('account_id', _revenue_account_id, 'debit', 0, 'credit', _amount, 'congregation_id', coalesce(_congregation_id::text,''))));
  INSERT INTO public.contributions (org_id, entry_id, kind, contributor, amount, contribution_date, congregation_id, member_id)
  VALUES (_org, _entry, _kind, _name, _amount, _date, _congregation_id, _member_id) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_org uuid, _entry_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e record; _new uuid;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão nesta organização'; END IF;
  IF length(coalesce(trim(_reason),'')) < 8 THEN RAISE EXCEPTION 'Justificativa deve ter ao menos 8 caracteres'; END IF;
  SELECT * INTO _e FROM public.journal_entries WHERE id = _entry_id AND org_id = _org FOR UPDATE;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'Lançamento não encontrado nesta organização'; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entry_reversals WHERE original_entry_id = _entry_id) THEN RAISE EXCEPTION 'Lançamento já estornado'; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entry_reversals WHERE reversal_entry_id = _entry_id) THEN RAISE EXCEPTION 'Não é possível estornar um estorno'; END IF;
  INSERT INTO public.journal_entries (org_id, entry_date, description, document, mode, created_by)
  VALUES (_org, current_date, 'Estorno: ' || _e.description, _e.document, _e.mode, auth.uid()) RETURNING id INTO _new;
  INSERT INTO public.journal_lines (entry_id, org_id, account_id, cost_center_id, congregation_id, debit, credit, memo)
  SELECT _new, _org, account_id, cost_center_id, congregation_id, credit, debit, 'Estorno'
  FROM public.journal_lines WHERE entry_id = _entry_id;
  INSERT INTO public.journal_entry_reversals (org_id, original_entry_id, reversal_entry_id, reason)
  VALUES (_org, _entry_id, _new, trim(_reason));
  RETURN _new;
END $$;

CREATE OR REPLACE FUNCTION public.close_fiscal_year(_org uuid, _year int, _profit_loss_account_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _entry uuid; _res numeric; _d date := make_date(_year,12,31); _has boolean;
BEGIN
  IF NOT public.is_org_admin(_org) THEN RAISE EXCEPTION 'Apenas administradores encerram o exercício'; END IF;
  IF _year > extract(year FROM current_date)::int THEN RAISE EXCEPTION 'Exercício futuro não pode ser encerrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.fiscal_year_closings WHERE org_id = _org AND fiscal_year = _year) THEN RAISE EXCEPTION 'Exercício % já encerrado', _year; END IF;
  IF EXISTS (SELECT 1 FROM public.fiscal_year_closings WHERE org_id = _org AND fiscal_year > _year) THEN RAISE EXCEPTION 'Existe exercício posterior encerrado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = _profit_loss_account_id AND org_id = _org AND type = 'patrimonio' AND analytic) THEN
    RAISE EXCEPTION 'Conta de destino deve ser analítica de patrimônio líquido desta organização'; END IF;
  WITH b AS (
    SELECT l.account_id, sum(l.debit - l.credit) AS bal
    FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id
    JOIN public.accounts a ON a.id = l.account_id
    WHERE l.org_id = _org AND a.type IN ('receita','despesa') AND e.entry_date BETWEEN make_date(_year,1,1) AND _d
    GROUP BY l.account_id HAVING sum(l.debit - l.credit) <> 0)
  SELECT coalesce(-sum(bal),0), count(*) > 0 INTO _res, _has FROM b;
  IF _has THEN
    INSERT INTO public.journal_entries (org_id, entry_date, description, document, mode, created_by)
    VALUES (_org, _d, 'Encerramento do exercício ' || _year || ' — apuração do resultado', 'ENC-' || _year, 'dobrada', auth.uid()) RETURNING id INTO _entry;
    INSERT INTO public.journal_lines (entry_id, org_id, account_id, debit, credit, memo)
    SELECT _entry, _org, account_id, CASE WHEN bal < 0 THEN -bal ELSE 0 END, CASE WHEN bal > 0 THEN bal ELSE 0 END, 'Zeramento'
    FROM (SELECT l.account_id, sum(l.debit - l.credit) AS bal
      FROM public.journal_lines l JOIN public.journal_entries e ON e.id = l.entry_id
      JOIN public.accounts a ON a.id = l.account_id
      WHERE l.org_id = _org AND a.type IN ('receita','despesa') AND e.entry_date BETWEEN make_date(_year,1,1) AND _d AND l.entry_id <> _entry
      GROUP BY l.account_id HAVING sum(l.debit - l.credit) <> 0) b;
    IF _res <> 0 THEN
      INSERT INTO public.journal_lines (entry_id, org_id, account_id, debit, credit, memo)
      VALUES (_entry, _org, _profit_loss_account_id, CASE WHEN _res < 0 THEN -_res ELSE 0 END, CASE WHEN _res > 0 THEN _res ELSE 0 END, 'Resultado do exercício');
    END IF;
  END IF;
  INSERT INTO public.fiscal_year_closings (org_id, fiscal_year, entry_id, profit_loss_account_id, result_amount, notes)
  VALUES (_org, _year, _entry, _profit_loss_account_id, _res, nullif(trim(_notes),''));
  RETURN _entry;
END $$;

CREATE OR REPLACE FUNCTION public.import_bank_statement(_org uuid, _bank_account_id uuid, _statement_date date, _opening_balance numeric,
  _closing_balance numeric, _import_source text, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _st uuid; _ins int; _total int;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão nesta organização'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bank_accounts WHERE id = _bank_account_id AND org_id = _org) THEN RAISE EXCEPTION 'Conta bancária não encontrada nesta organização'; END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'Extrato sem linhas'; END IF;
  _total := jsonb_array_length(_rows);
  INSERT INTO public.bank_statements (org_id, bank_account_id, statement_date, opening_balance, closing_balance, import_source)
  VALUES (_org, _bank_account_id, _statement_date, coalesce(_opening_balance,0), coalesce(_closing_balance,0), _import_source) RETURNING id INTO _st;
  INSERT INTO public.bank_statement_lines (org_id, statement_id, bank_account_id, transaction_date, description, amount, document, direction, line_hash)
  SELECT _org, _st, _bank_account_id, (r->>'transaction_date')::date, trim(r->>'description'), abs((r->>'amount')::numeric),
         nullif(trim(r->>'document'),''), CASE WHEN r->>'direction' = 'debit' THEN 'debit' ELSE 'credit' END,
         md5(concat_ws('|', r->>'transaction_date', trim(r->>'description'), abs((r->>'amount')::numeric)::text, coalesce(trim(r->>'document'),''), r->>'direction'))
  FROM jsonb_array_elements(_rows) r
  ON CONFLICT (bank_account_id, line_hash) DO NOTHING;
  GET DIAGNOSTICS _ins = ROW_COUNT;
  IF _ins = 0 THEN RAISE EXCEPTION 'Todas as % linhas já tinham sido importadas', _total; END IF;
  RETURN jsonb_build_object('statement_id', _st, 'inserted', _ins, 'duplicates', _total - _ins);
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_bank_statement_line(_org uuid, _statement_line_id uuid, _journal_line_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _j record; _bank_acc uuid; _val numeric;
BEGIN
  IF NOT public.can_write(_org) THEN RAISE EXCEPTION 'Sem permissão nesta organização'; END IF;
  SELECT * INTO _s FROM public.bank_statement_lines WHERE id = _statement_line_id AND org_id = _org FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Linha do extrato não encontrada nesta organização'; END IF;
  IF _s.reconciliation_status = 'matched' THEN RAISE EXCEPTION 'Linha do extrato já conciliada'; END IF;
  SELECT l.id, l.account_id, l.debit, l.credit INTO _j FROM public.journal_lines l
    WHERE l.id = _journal_line_id AND l.org_id = _org;
  IF _j.id IS NULL THEN RAISE EXCEPTION 'Lançamento contábil não encontrado nesta organização'; END IF;
  IF EXISTS (SELECT 1 FROM public.bank_statement_lines WHERE journal_line_id = _journal_line_id) THEN RAISE EXCEPTION 'Lançamento já conciliado com outra linha'; END IF;
  SELECT account_id INTO _bank_acc FROM public.bank_accounts WHERE id = _s.bank_account_id;
  IF _j.account_id <> _bank_acc THEN RAISE EXCEPTION 'O lançamento não pertence à conta contábil desta conta bancária'; END IF;
  _val := CASE WHEN _s.direction = 'credit' THEN _j.debit ELSE _j.credit END;
  IF abs(_val - _s.amount) > 0.01 THEN RAISE EXCEPTION 'Divergência de valor: extrato %, razão %', _s.amount, _val; END IF;
  UPDATE public.bank_statement_lines SET reconciliation_status = 'matched', journal_line_id = _journal_line_id, reconciled_at = now(), reconciled_by = auth.uid() WHERE id = _statement_line_id;
  INSERT INTO public.bank_reconciliations (org_id, statement_line_id, journal_line_id, difference) VALUES (_org, _statement_line_id, _journal_line_id, _val - _s.amount);
END $$;

REVOKE EXECUTE ON FUNCTION public.approve_annual_budget(uuid,uuid), public.reject_annual_budget(uuid,uuid,text),
  public.record_inventory_movement(uuid,uuid,text,numeric,date,uuid,uuid,numeric,text,text,text), public.submit_physical_inventory(uuid,uuid),
  public.approve_physical_inventory(uuid,uuid), public.reverse_journal_entry(uuid,uuid,text), public.close_fiscal_year(uuid,int,uuid,text),
  public.import_bank_statement(uuid,uuid,date,numeric,numeric,text,jsonb), public.reconcile_bank_statement_line(uuid,uuid,uuid),
  public.create_contribution(uuid,date,contribution_kind,uuid,text,numeric,uuid,uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_annual_budget(uuid,uuid), public.reject_annual_budget(uuid,uuid,text),
  public.record_inventory_movement(uuid,uuid,text,numeric,date,uuid,uuid,numeric,text,text,text), public.submit_physical_inventory(uuid,uuid),
  public.approve_physical_inventory(uuid,uuid), public.reverse_journal_entry(uuid,uuid,text), public.close_fiscal_year(uuid,int,uuid,text),
  public.import_bank_statement(uuid,uuid,date,numeric,numeric,text,jsonb), public.reconcile_bank_statement_line(uuid,uuid,uuid),
  public.create_contribution(uuid,date,contribution_kind,uuid,text,numeric,uuid,uuid,uuid) TO authenticated;