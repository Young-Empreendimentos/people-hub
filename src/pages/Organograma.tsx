import { useState } from "react";
import { useOrganograma, type OrgNode } from "@/hooks/useOrganograma";
import { useAuth } from "@/hooks/useAuth";
import { OrgTreeView } from "@/components/organograma/OrgTree";
import { OrgEditPopover } from "@/components/organograma/OrgEditPopover";
import { Input } from "@/components/ui/input";
import { Search, Network } from "lucide-react";
import { toast } from "sonner";

export default function Organograma() {
  const { tree, employees, isLoading, countDescendants, getDescendantIds, updateGestor, isUpdating } = useOrganograma();
  const { canDelete } = useAuth();
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [search, setSearch] = useState("");

  const handleSave = (employeeId: string, gestorId: string | null) => {
    updateGestor(
      { employeeId, gestorId },
      {
        onSuccess: () => {
          toast.success("Hierarquia atualizada.");
          setEditingNode(null);
        },
        onError: () => toast.error("Erro ao atualizar hierarquia."),
      }
    );
  };

  const excludeIds = editingNode ? getDescendantIds(editingNode.id) : new Set<string>();

  const hasHierarchy = tree.some((n) => n.children.length > 0);

  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">Carregando organograma...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionário..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!hasHierarchy && tree.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30">
          <Network className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {canDelete
              ? "Nenhuma hierarquia definida. Passe o mouse sobre um card e clique no ícone de edição para definir o gestor direto."
              : "A hierarquia ainda não foi configurada."}
          </p>
        </div>
      )}

      <OrgTreeView
        roots={tree}
        canEdit={canDelete}
        onEdit={setEditingNode}
        countDescendants={countDescendants}
      />

      <OrgEditPopover
        node={editingNode}
        employees={employees.map((e) => ({ id: e.id, nome_completo: e.nome_completo }))}
        excludeIds={excludeIds}
        onSave={handleSave}
        onClose={() => setEditingNode(null)}
        isUpdating={isUpdating}
      />
    </div>
  );
}
