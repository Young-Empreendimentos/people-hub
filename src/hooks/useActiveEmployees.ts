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
      // Para cada funcionário, percorre eventos em ordem cronológica.
      // Se houve desligamento seguido de admissão em até 31 dias, trata como
      // transferência de CNPJ e mantém a data de admissão original.
      // Caso contrário (gap > 31 dias), considera readmissão e usa a nova data.
      const TRANSFER_GAP_DAYS = 31;
      for (const [funcId, rows] of Object.entries(byFunc)) {
        const asc = [...rows].sort((a, b) => a.data.localeCompare(b.data));
        let currentStart: string | null = null;
        let pendingDesl: string | null = null;
        for (const ev of asc) {
          if (ev.tipo === "admissao") {
            if (currentStart === null) {
              currentStart = ev.data;
            } else if (pendingDesl) {
              const diffDays = Math.round(
                (new Date(ev.data).getTime() - new Date(pendingDesl).getTime()) / 86400000
              );
              if (diffDays > TRANSFER_GAP_DAYS) {
                currentStart = ev.data; // readmissão real
              }
              // se gap <= 31 dias, é transferência: mantém currentStart
            }
            pendingDesl = null;
          } else if (ev.tipo === "desligamento") {
            pendingDesl = ev.data;
          }
        }
        if (currentStart) admissaoMap[funcId] = currentStart;
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
