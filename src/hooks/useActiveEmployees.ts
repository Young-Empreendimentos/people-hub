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

  const { data: statusMap = {} } = useQuery({
    queryKey: ["rh_status_funcionarios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*")
        .order("data", { ascending: false });
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (!map[row.funcionario_id]) map[row.funcionario_id] = row.tipo;
      }
      return map;
    },
  });

  const isActive = (funcId: string) =>
    (statusMap as Record<string, string>)[funcId] !== "desligamento";

  const activeCount = funcionarios.filter((f) => isActive(f.id)).length;

  const getActiveByField = (field: "equipe_id" | "empresa_id", value: string) =>
    funcionarios.filter((f) => (f as any)[field] === value && isActive(f.id));

  return { funcionarios, statusMap, isActive, activeCount, isLoading, getActiveByField };
}
