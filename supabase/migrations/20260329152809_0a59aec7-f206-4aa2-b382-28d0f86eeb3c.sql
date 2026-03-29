
-- Enum for user roles
CREATE TYPE public.rh_app_role AS ENUM ('admin', 'coordenador', 'usuario');

-- Basic reference tables
CREATE TABLE public.rh_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_trilhas_cargo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trilha_id UUID REFERENCES public.rh_trilhas_cargo(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  nivel INT NOT NULL DEFAULT 1,
  remuneracao NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_tipos_aditivo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Funcionarios
CREATE TABLE public.rh_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  rg TEXT,
  cpf TEXT,
  endereco TEXT,
  aniversario DATE,
  empresa_id UUID REFERENCES public.rh_empresas(id),
  equipe_id UUID REFERENCES public.rh_equipes(id),
  cargo_id UUID REFERENCES public.rh_cargos(id),
  data_contrato_vigente DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_funcionario_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('documento', 'comprovante', 'contrato')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_admissoes_desligamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('admissao', 'desligamento')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  anexo_path TEXT,
  anexo_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_aditivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  tipo_aditivo_id UUID REFERENCES public.rh_tipos_aditivo(id),
  empresa_final_id UUID REFERENCES public.rh_empresas(id),
  cargo_final_id UUID REFERENCES public.rh_cargos(id),
  equipe_final_id UUID REFERENCES public.rh_equipes(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  anexo_path TEXT,
  anexo_name TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  datas_pagamento_pretendidas TEXT[],
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  avaliador_id UUID REFERENCES public.rh_funcionarios(id),
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  pontuacao_resultados INT NOT NULL DEFAULT 1 CHECK (pontuacao_resultados BETWEEN 1 AND 5),
  pontuacao_valores INT NOT NULL DEFAULT 1 CHECK (pontuacao_valores BETWEEN 1 AND 5),
  pontuacao_metas NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pontuacao_metas BETWEEN 0 AND 100),
  pontuacao_auditorias NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pontuacao_auditorias BETWEEN 0 AND 100),
  anexo_path TEXT,
  anexo_name TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_folha_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  mes_referencia DATE NOT NULL,
  horas_atraso_faltas NUMERIC(6,2) NOT NULL DEFAULT 0,
  horas_extra NUMERIC(6,2) NOT NULL DEFAULT 0,
  plano_saude BOOLEAN NOT NULL DEFAULT false,
  desconto_titulo_parque BOOLEAN NOT NULL DEFAULT false,
  auxilio_educacional BOOLEAN NOT NULL DEFAULT false,
  descontos_adiantamentos NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_comissoes NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_plr NUMERIC(12,2) NOT NULL DEFAULT 0,
  anexo_holerite_path TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_grupos_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  responsavel_id UUID REFERENCES public.rh_funcionarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES public.rh_grupos_atividades(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  manual_link TEXT,
  metodos_auditoria TEXT,
  responsavel_id UUID REFERENCES public.rh_funcionarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles and profiles for the RH system
CREATE TABLE public.rh_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role rh_app_role NOT NULL DEFAULT 'usuario',
  UNIQUE (user_id, role)
);

CREATE TABLE public.rh_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.rh_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rh_user_profiles (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_rh
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rh_handle_new_user();

-- Updated_at trigger for funcionarios
CREATE OR REPLACE FUNCTION public.rh_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER rh_funcionarios_updated_at
  BEFORE UPDATE ON public.rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.rh_has_role(_user_id UUID, _role rh_app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rh_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-anexos', 'rh-anexos', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.rh_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_trilhas_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_tipos_aditivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_funcionario_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_admissoes_desligamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_adiantamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_folha_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_grupos_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read all RH data
CREATE POLICY "rh_read_all" ON public.rh_equipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_trilhas_cargo FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_tipos_aditivo FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_funcionario_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_admissoes_desligamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_aditivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_adiantamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_avaliacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_folha_mensal FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_grupos_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_read_all" ON public.rh_user_profiles FOR SELECT TO authenticated USING (true);

-- RLS: Admin and coordenador can insert/update all
CREATE POLICY "rh_insert_admin_coord" ON public.rh_equipes FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_equipes FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_equipes FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_empresas FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_empresas FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_empresas FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_trilhas_cargo FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_trilhas_cargo FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_trilhas_cargo FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_cargos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_cargos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_cargos FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

-- Tipos aditivo: admin only
CREATE POLICY "rh_insert_admin" ON public.rh_tipos_aditivo FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin'));
CREATE POLICY "rh_update_admin" ON public.rh_tipos_aditivo FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin'));
CREATE POLICY "rh_delete_admin" ON public.rh_tipos_aditivo FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_funcionarios FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_funcionarios FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_funcionarios FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_funcionario_anexos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_funcionario_anexos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_funcionario_anexos FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_admissoes_desligamentos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_admissoes_desligamentos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_admissoes_desligamentos FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_aditivos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_aditivos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_aditivos FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_adiantamentos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_adiantamentos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_adiantamentos FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_avaliacoes FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_avaliacoes FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_avaliacoes FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_folha_mensal FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_folha_mensal FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_folha_mensal FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_grupos_atividades FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_grupos_atividades FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_grupos_atividades FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

CREATE POLICY "rh_insert_admin_coord" ON public.rh_atividades FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_atividades FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_atividades FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin') OR rh_has_role(auth.uid(), 'coordenador'));

-- User roles: admin only can manage
CREATE POLICY "rh_read_own_role" ON public.rh_user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR rh_has_role(auth.uid(), 'admin'));
CREATE POLICY "rh_insert_admin" ON public.rh_user_roles FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'admin'));
CREATE POLICY "rh_update_admin" ON public.rh_user_roles FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'admin'));
CREATE POLICY "rh_delete_admin" ON public.rh_user_roles FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin'));

-- User profiles: users can read all, update own
CREATE POLICY "rh_update_own_profile" ON public.rh_user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Storage RLS for rh-anexos
CREATE POLICY "rh_storage_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'rh-anexos');
CREATE POLICY "rh_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rh-anexos');
CREATE POLICY "rh_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rh-anexos' AND (public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')));

-- Also allow usuario to insert (they can create records, just not delete)
-- Update the insert policies for usuario role
CREATE POLICY "rh_insert_usuario" ON public.rh_funcionarios FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_funcionarios FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_funcionario_anexos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_funcionario_anexos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_admissoes_desligamentos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_admissoes_desligamentos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_aditivos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_aditivos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_adiantamentos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_adiantamentos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_avaliacoes FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_avaliacoes FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_folha_mensal FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_folha_mensal FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_grupos_atividades FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_grupos_atividades FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_atividades FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_atividades FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_equipes FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_equipes FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_empresas FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_empresas FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_trilhas_cargo FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_trilhas_cargo FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));

CREATE POLICY "rh_insert_usuario" ON public.rh_cargos FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(), 'usuario'));
CREATE POLICY "rh_update_usuario" ON public.rh_cargos FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(), 'usuario'));
