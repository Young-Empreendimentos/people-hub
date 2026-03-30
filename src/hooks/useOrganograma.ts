import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgNode {
  id: string;
  nome_completo: string;
  cargo_nome: string | null;
  equipe_nome: string | null;
  foto_url: string | null;
  gestor_id: string | null;
  children: OrgNode[];
}

export function useOrganograma() {
  const queryClient = useQueryClient();

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

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["rh_funcionarios_org"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("id, nome_completo, gestor_id, foto_url, cargo_id, equipe_id, rh_cargos(nome), rh_equipes(nome)")
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const isActive = (funcId: string) =>
    (statusMap as Record<string, string>)[funcId] !== "desligamento";

  const activeEmployees = employees.filter((e) => isActive(e.id));

  const buildTree = (): OrgNode[] => {
    const nodeMap = new Map<string, OrgNode>();
    for (const emp of activeEmployees) {
      nodeMap.set(emp.id, {
        id: emp.id,
        nome_completo: emp.nome_completo,
        cargo_nome: (emp.rh_cargos as any)?.nome || null,
        equipe_nome: (emp.rh_equipes as any)?.nome || null,
        foto_url: emp.foto_url,
        gestor_id: emp.gestor_id,
        children: [],
      });
    }

    const roots: OrgNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.gestor_id && nodeMap.has(node.gestor_id)) {
        nodeMap.get(node.gestor_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortChildren = (node: OrgNode) => {
      node.children.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      node.children.forEach(sortChildren);
    };
    roots.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    roots.forEach(sortChildren);

    return roots;
  };

  const tree = buildTree();

  const countDescendants = (node: OrgNode): number => {
    let count = node.children.length;
    for (const child of node.children) count += countDescendants(child);
    return count;
  };

  const getDescendantIds = (nodeId: string): Set<string> => {
    const ids = new Set<string>();
    const collect = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        ids.add(n.id);
        collect(n.children);
      }
    };
    const findNode = (nodes: OrgNode[]): OrgNode | undefined => {
      for (const n of nodes) {
        if (n.id === nodeId) return n;
        const found = findNode(n.children);
        if (found) return found;
      }
    };
    const node = findNode(tree);
    if (node) collect(node.children);
    return ids;
  };

  const updateGestorMutation = useMutation({
    mutationFn: async ({ employeeId, gestorId }: { employeeId: string; gestorId: string | null }) => {
      const { error } = await supabase
        .from("rh_funcionarios")
        .update({ gestor_id: gestorId })
        .eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionarios_org"] });
      queryClient.invalidateQueries({ queryKey: ["rh_funcionarios"] });
    },
  });

  return {
    tree,
    employees: activeEmployees,
    isLoading,
    countDescendants,
    getDescendantIds,
    updateGestor: updateGestorMutation.mutate,
    isUpdating: updateGestorMutation.isPending,
  };
}
