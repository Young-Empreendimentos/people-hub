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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export default function Cargos() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();

  const [trilhaDialogOpen, setTrilhaDialogOpen] = useState(false);
  const [editingTrilhaId, setEditingTrilhaId] = useState<string | null>(null);
  const [trilhaNome, setTrilhaNome] = useState("");

  const [cargoDialogOpen, setCargoDialogOpen] = useState(false);
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [cargoTrilhaId, setCargoTrilhaId] = useState("");
  const [cargoTrilhaNome, setCargoTrilhaNome] = useState("");
  const [cargoNivel, setCargoNivel] = useState(1);
  const [cargoRemuneracao, setCargoRemuneracao] = useState("");
  const [cargoAdicionais, setCargoAdicionais] = useState("");

  const { data: trilhas = [], isLoading: loadingTrilhas } = useQuery({
    queryKey: ["rh_trilhas_cargo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_trilhas_cargo").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_cargos").select("*").order("nivel");
      if (error) throw error;
      return data;
    },
  });

  const buildCargoName = (trilhaNome: string, nivel: number) => {
    const numeral = nivel <= ROMAN.length ? ROMAN[nivel - 1] : String(nivel);
    return `${trilhaNome} ${numeral}`;
  };

  const saveTrilha = useMutation({
    mutationFn: async () => {
      if (editingTrilhaId) {
        const { error } = await supabase.from("rh_trilhas_cargo").update({ nome: trilhaNome }).eq("id", editingTrilhaId);
        if (error) throw error;
        // Update all cargo names under this trilha
        const trilhaCargos = cargos.filter((c) => c.trilha_id === editingTrilhaId);
        for (const cargo of trilhaCargos) {
          const newName = buildCargoName(trilhaNome, cargo.nivel);
          await supabase.from("rh_cargos").update({ nome: newName }).eq("id", cargo.id);
        }
      } else {
        const { error } = await supabase.from("rh_trilhas_cargo").insert({ nome: trilhaNome });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_trilhas_cargo"] });
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      toast.success(editingTrilhaId ? "Trilha atualizada." : "Trilha criada.");
      setTrilhaDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar trilha."),
  });

  const deleteTrilha = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_trilhas_cargo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_trilhas_cargo"] });
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      toast.success("Trilha excluída.");
    },
    onError: () => toast.error("Erro ao excluir trilha. Verifique se não há cargos vinculados."),
  });

  const saveCargo = useMutation({
    mutationFn: async () => {
      const nome = buildCargoName(cargoTrilhaNome, cargoNivel);
      const payload = {
        trilha_id: cargoTrilhaId,
        nome,
        nivel: cargoNivel,
        remuneracao: parseFloat(cargoRemuneracao) || 0,
        adicionais: cargoAdicionais || null,
      };
      if (editingCargoId) {
        const { error } = await supabase.from("rh_cargos").update(payload).eq("id", editingCargoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_cargos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      toast.success(editingCargoId ? "Cargo atualizado." : "Cargo criado.");
      setCargoDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar cargo."),
  });

  const deleteCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_cargos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      toast.success("Cargo excluído.");
    },
    onError: () => toast.error("Erro ao excluir cargo."),
  });

  const openNewTrilha = () => { setEditingTrilhaId(null); setTrilhaNome(""); setTrilhaDialogOpen(true); };
  const openEditTrilha = (t: { id: string; nome: string }) => { setEditingTrilhaId(t.id); setTrilhaNome(t.nome); setTrilhaDialogOpen(true); };

  const openNewCargo = (trilha: { id: string; nome: string }) => {
    const trilhaCargos = cargos.filter((c) => c.trilha_id === trilha.id);
    const nextLevel = trilhaCargos.length > 0 ? Math.max(...trilhaCargos.map((c) => c.nivel)) + 1 : 1;
    setEditingCargoId(null);
    setCargoTrilhaId(trilha.id);
    setCargoTrilhaNome(trilha.nome);
    setCargoNivel(nextLevel);
    setCargoRemuneracao("");
    setCargoAdicionais("");
    setCargoDialogOpen(true);
  };

  const openEditCargo = (c: any, trilhaNome: string) => {
    setEditingCargoId(c.id);
    setCargoTrilhaId(c.trilha_id);
    setCargoTrilhaNome(trilhaNome);
    setCargoNivel(c.nivel);
    setCargoRemuneracao(String(c.remuneracao));
    setCargoAdicionais(c.adicionais || "");
    setCargoDialogOpen(true);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={openNewTrilha}><Plus className="mr-2 h-4 w-4" /> Nova Trilha</Button>
      </div>

      {loadingTrilhas ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : trilhas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma trilha cadastrada.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {trilhas.map((trilha) => {
            const trilhaCargos = cargos.filter((c) => c.trilha_id === trilha.id);
            return (
              <AccordionItem key={trilha.id} value={trilha.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{trilha.nome}</span>
                    <span className="text-xs text-muted-foreground">({trilhaCargos.length} cargos)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditTrilha(trilha)}>
                        <Pencil className="mr-1 h-3 w-3" /> Editar Trilha
                      </Button>
                      {canDelete && (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteTrilha.mutate(trilha.id)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Excluir Trilha
                        </Button>
                      )}
                      <Button size="sm" onClick={() => openNewCargo(trilha)}>
                        <Plus className="mr-1 h-3 w-3" /> Novo Cargo
                      </Button>
                    </div>
                    {trilhaCargos.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cargo</TableHead>
                            <TableHead className="w-20">Nível</TableHead>
                            <TableHead className="w-40">Remuneração</TableHead>
                            <TableHead>Adicionais</TableHead>
                            <TableHead className="w-24 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trilhaCargos.map((cargo) => (
                            <TableRow key={cargo.id}>
                              <TableCell>{cargo.nome}</TableCell>
                              <TableCell>{cargo.nivel}</TableCell>
                              <TableCell>{formatCurrency(Number(cargo.remuneracao))}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{cargo.adicionais || "—"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditCargo(cargo, trilha.nome)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {canDelete && (
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteCargo.mutate(cargo.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Trilha Dialog */}
      <Dialog open={trilhaDialogOpen} onOpenChange={setTrilhaDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTrilhaId ? "Editar Trilha" : "Nova Trilha"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Trilha</label>
              <Input value={trilhaNome} onChange={(e) => setTrilhaNome(e.target.value)} placeholder="Ex: Analista de Engenharia" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrilhaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTrilha.mutate()} disabled={!trilhaNome.trim() || saveTrilha.isPending}>
              {saveTrilha.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cargo Dialog */}
      <Dialog open={cargoDialogOpen} onOpenChange={setCargoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCargoId ? "Editar Cargo" : "Novo Cargo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome gerado</label>
              <Input value={buildCargoName(cargoTrilhaNome, cargoNivel)} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nível</label>
                <Input type="number" min={1} value={cargoNivel} onChange={(e) => setCargoNivel(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Remuneração (R$)</label>
                <Input type="number" step="0.01" min={0} value={cargoRemuneracao} onChange={(e) => setCargoRemuneracao(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Adicionais</label>
              <Input value={cargoAdicionais} onChange={(e) => setCargoAdicionais(e.target.value)} placeholder="Ex: Vale transporte, plano de saúde" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCargoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveCargo.mutate()} disabled={cargoNivel < 1 || saveCargo.isPending}>
              {saveCargo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
