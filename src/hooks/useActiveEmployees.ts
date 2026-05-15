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
      // Group rows per funcionario
      const byFunc: Record<string, Array<{ tipo: string; data: string }>> = {};
      for (const row of data || []) {
        if (!statusMap[row.funcionario_id]) statusMap[row.funcionario_id] = row.tipo;
        (byFunc[row.funcionario_id] ||= []).push({ tipo: row.tipo, data: row.data });
      }
      // For each funcionario: take earliest admissao after the most recent desligamento.
      // If there is no desligamento (only transferências entre CNPJs), take the earliest admissao overall.
      for (const [funcId, rows] of Object.entries(byFunc)) {
        const asc = [...rows].sort((a, b) => a.data.localeCompare(b.data));
        let lastDesligamentoIdx = -1;
        for (let i = asc.length - 1; i >= 0; i--) {
          if (asc[i].tipo === "desligamento") { lastDesligamentoIdx = i; break; }
        }
        const pool = lastDesligamentoIdx >= 0 ? asc.slice(lastDesligamentoIdx + 1) : asc;
        const firstAdm = pool.find((r) => r.tipo === "admissao");
        if (firstAdm) admissaoMap[funcId] = firstAdm.data;
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
