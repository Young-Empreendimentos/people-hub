import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

function TiposAditivoTab() {
  const queryClient = useQueryClient();
  const { canConfig, canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["rh_tipos_aditivo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_tipos_aditivo").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("rh_tipos_aditivo").update({ nome }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_tipos_aditivo").insert({ nome });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_tipos_aditivo"] });
      toast.success(editingId ? "Tipo atualizado." : "Tipo criado.");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar tipo de aditivo."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_tipos_aditivo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_tipos_aditivo"] });
      toast.success("Tipo excluído.");
    },
    onError: () => toast.error("Erro ao excluir tipo de aditivo."),
  });

  if (!canConfig) return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingId(null); setNome(""); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Tipo
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
          ) : tipos.length === 0 ? (
            <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Nenhum tipo cadastrado.</TableCell></TableRow>
          ) : tipos.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">{t.nome}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingId(t.id); setNome(t.nome); setDialogOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Tipo de Aditivo" : "Novo Tipo de Aditivo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Alteração de cargo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Configuracoes() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      <p className="text-muted-foreground">Configurações do sistema (apenas administradores).</p>

      <Tabs defaultValue="tipos-aditivo">
        <TabsList>
          <TabsTrigger value="tipos-aditivo">Tipos de Aditivo</TabsTrigger>
        </TabsList>
        <TabsContent value="tipos-aditivo">
          <Card>
            <CardHeader><CardTitle>Tipos de Aditivo</CardTitle></CardHeader>
            <CardContent><TiposAditivoTab /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
