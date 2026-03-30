import { type OrgNode } from "@/hooks/useOrganograma";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { useState, useEffect } from "react";

interface OrgEditPopoverProps {
  node: OrgNode | null;
  employees: { id: string; nome_completo: string }[];
  excludeIds: Set<string>;
  onSave: (employeeId: string, gestorId: string | null) => void;
  onClose: () => void;
  isUpdating: boolean;
}

export function OrgEditPopover({
  node,
  employees,
  excludeIds,
  onSave,
  onClose,
  isUpdating,
}: OrgEditPopoverProps) {
  const [gestorId, setGestorId] = useState<string>("");

  useEffect(() => {
    if (node) setGestorId(node.gestor_id || "");
  }, [node]);

  if (!node) return null;

  const options = employees
    .filter((e) => e.id !== node.id && !excludeIds.has(e.id))
    .map((e) => ({ value: e.id, label: e.nome_completo }));

  return (
    <Dialog open={!!node} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar Gestor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm">
            <span className="font-medium">{node.nome_completo}</span>
            {node.cargo_nome && <span className="text-muted-foreground"> — {node.cargo_nome}</span>}
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Gestor Direto</label>
            <Combobox
              options={options}
              value={gestorId}
              onValueChange={setGestorId}
              placeholder="Selecione o gestor"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {node.gestor_id && (
            <Button
              variant="outline"
              size="sm"
              className="mr-auto text-destructive"
              onClick={() => onSave(node.id, null)}
              disabled={isUpdating}
            >
              Remover Gestor
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onSave(node.id, gestorId || null)}
            disabled={isUpdating || gestorId === (node.gestor_id || "")}
          >
            {isUpdating ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
