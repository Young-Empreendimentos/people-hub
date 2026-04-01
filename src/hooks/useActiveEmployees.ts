import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useActiveEmployees() {
  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("*, rh_empresas(nome), rh_equipes(nome), rh_cargos(nome)")
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const { data: admissaoData = { statusMap: {}, admissaoMap: {} } } = useQuery({
    queryKey: ["rh_status_funcionarios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*")
        .order("data", { ascending: false });
      const statusMap: Record<string, string> = {};
      const admissaoMap: Record<string, string> = {};
      for (const row of data || []) {
        if (!statusMap[row.funcionario_id]) statusMap[row.funcionario_id] = row.tipo;
        // Keep the earliest admissao date per employee
        if (row.tipo === "admissao") admissaoMap[row.funcionario_id] = row.data;
      }
      return { statusMap, admissaoMap };
    },
  });

  const { statusMap, admissaoMap } = admissaoData;

  const isActive = (funcId: string) =>
    (statusMap as Record<string, string>)[funcId] !== "desligamento";

  const activeCount = funcionarios.filter((f) => isActive(f.id)).length;

  const getActiveByField = (field: "equipe_id" | "empresa_id", value: string) =>
    funcionarios.filter((f) => (f as any)[field] === value && isActive(f.id));

  return { funcionarios, statusMap, admissaoMap, isActive, activeCount, isLoading, getActiveByField };
}
