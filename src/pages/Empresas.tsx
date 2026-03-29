import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Empresas() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["rh_empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_empresas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("rh_empresas").update({ nome }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_empresas").insert({ nome });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_empresas"] });
      toast.success(editingId ? "Empresa atualizada." : "Empresa criada.");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar empresa."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_empresas"] });
      toast.success("Empresa excluída.");
    },
    onError: () => toast.error("Erro ao excluir empresa."),
  });

  const openNew = () => { setEditingId(null); setNome(""); setDialogOpen(true); };
  const openEdit = (e: { id: string; nome: string }) => { setEditingId(e.id); setNome(e.nome); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setNome(""); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas contratantes.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Empresa</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : empresas.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhuma empresa cadastrada.</TableCell></TableRow>
              ) : empresas.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.nome}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(emp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Empresa</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Young Empreendimentos" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
