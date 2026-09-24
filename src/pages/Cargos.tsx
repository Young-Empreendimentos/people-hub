import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rhDb } from "@/integrations/supabase/client";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { sugerirNomeCargo, proximoNivel as proximoNivelDaFuncao } from "@/lib/cargos";

// Modelo: trilha = ÁREA (Administrativo, Comercial…); função = o papel dentro da
// área; cargo = função + nível + pacote de remuneração.
//
// Esta tela gerava o nome de todo cargo como "trilha + romano" — inclusive ao
// EDITAR, e ao renomear a trilha renomeava todos os cargos dela. Isso só batia
// com o Comercial; nos demais (59 de 75 cargos, 42 funcionários) uma edição de
// salário renomeava "Coordenador Administrativo" para "Administrativo V". Agora o
// nome é do cargo, editável, e preservado na edição.
const NOVA_FUNCAO = "__nova__";

export default function Cargos() {
  const queryClient = useQueryClient();
  const { canDelete, canManageCargos } = useAuth();

  const [trilhaDialogOpen, setTrilhaDialogOpen] = useState(false);
  const [editingTrilhaId, setEditingTrilhaId] = useState<string | null>(null);
  const [trilhaNome, setTrilhaNome] = useState("");

  const [cargoDialogOpen, setCargoDialogOpen] = useState(false);
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [cargoTrilhaId, setCargoTrilhaId] = useState("");
  const [cargoFuncaoId, setCargoFuncaoId] = useState("");
  const [cargoNovaFuncao, setCargoNovaFuncao] = useState("");
  const [cargoNome, setCargoNome] = useState("");
  // Enquanto o usuário não mexe no nome, ele acompanha a sugestão; depois de
  // editado à mão, a sugestão não sobrescreve mais.
  const [nomeEditado, setNomeEditado] = useState(false);
  const [cargoNivel, setCargoNivel] = useState(1);
  const [cargoRemuneracao, setCargoRemuneracao] = useState("");
  const [cargoAdicionais, setCargoAdicionais] = useState("");

  const { data: trilhas = [], isLoading: loadingTrilhas } = useQuery({
    queryKey: ["rh_trilhas_cargo"],
    queryFn: async () => {
      const { data, error } = await rhDb.from("rh_trilhas_cargo").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos"],
    queryFn: async () => {
      const { data, error } = await rhDb.from("rh_cargos").select("*").order("nivel");
      if (error) throw error;
      return data;
    },
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ["rh_funcoes"],
    queryFn: async () => {
      const { data, error } = await rhDb.from("rh_funcoes").select("id, trilha_id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; trilha_id: string; nome: string }[];
    },
  });

  const funcaoNome = (id: string | null | undefined) => funcoes.find((f) => f.id === id)?.nome ?? "—";
  const funcoesDaTrilha = useMemo(
    () => funcoes.filter((f) => f.trilha_id === cargoTrilhaId),
    [funcoes, cargoTrilhaId],
  );

  const cargosDaFuncao = (funcaoId: string) => cargos.filter((c: any) => c.funcao_id === funcaoId);

  /** Próximo nível livre dentro da função (não da trilha inteira). */
  const proximoNivel = (funcaoId: string) => proximoNivelDaFuncao(cargosDaFuncao(funcaoId));

  const sugerirNome = (funcaoId: string, nomeFuncao: string, nivel: number) =>
    sugerirNomeCargo(nomeFuncao, cargosDaFuncao(funcaoId), nivel);

  const nomeFuncaoEscolhida =
    cargoFuncaoId === NOVA_FUNCAO ? cargoNovaFuncao.trim() : funcaoNome(cargoFuncaoId);

  // Atualiza a sugestão quando muda função/nível, até o usuário editar o nome.
  const aplicarSugestao = (funcaoId: string, nivel: number, nomeFuncao: string) => {
    if (nomeEditado || !nomeFuncao || nomeFuncao === "—") return;
    setCargoNome(funcaoId === NOVA_FUNCAO ? nomeFuncao : sugerirNome(funcaoId, nomeFuncao, nivel));
  };

  const saveTrilha = useMutation({
    mutationFn: async () => {
      if (editingTrilhaId) {
        // Renomear a área não renomeia os cargos: o nome do cargo é da função,
        // não da trilha. Antes, este passo reescrevia todos os cargos da trilha
        // como "trilha + romano", fundindo funções diferentes no mesmo nome.
        const { error } = await rhDb.from("rh_trilhas_cargo").update({ nome: trilhaNome }).eq("id", editingTrilhaId);
        if (error) throw error;
      } else {
        const { error } = await rhDb.from("rh_trilhas_cargo").insert({ nome: trilhaNome });
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
      const { error } = await rhDb.from("rh_trilhas_cargo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_trilhas_cargo"] });
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      toast.success("Trilha excluída.");
    },
    onError: () => toast.error("Erro ao excluir trilha. Verifique se não há cargos ou funções vinculados."),
  });

  const saveCargo = useMutation({
    mutationFn: async () => {
      let funcaoId = cargoFuncaoId;
      if (funcaoId === NOVA_FUNCAO) {
        // Se já existe função com esse nome na trilha, reaproveita em vez de
        // bater no índice único.
        const nome = cargoNovaFuncao.trim();
        const existente = funcoesDaTrilha.find(
          (f) => f.nome.trim().toLowerCase() === nome.toLowerCase(),
        );
        if (existente) {
          funcaoId = existente.id;
        } else {
          const { data, error } = await rhDb
            .from("rh_funcoes")
            .insert({ trilha_id: cargoTrilhaId, nome })
            .select("id")
            .single();
          if (error) throw error;
          funcaoId = (data as any).id;
        }
      }
      const payload = {
        trilha_id: cargoTrilhaId,
        funcao_id: funcaoId,
        nome: cargoNome.trim(),
        nivel: cargoNivel,
        remuneracao: parseFloat(cargoRemuneracao) || 0,
        adicionais: cargoAdicionais || null,
      };
      if (editingCargoId) {
        const { error } = await rhDb.from("rh_cargos").update(payload).eq("id", editingCargoId);
        if (error) throw error;
      } else {
        const { error } = await rhDb.from("rh_cargos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_cargos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_funcoes"] });
      toast.success(editingCargoId ? "Cargo atualizado." : "Cargo criado.");
      setCargoDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar cargo."),
  });

  const deleteCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rhDb.from("rh_cargos").delete().eq("id", id);
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
    setEditingCargoId(null);
    setCargoTrilhaId(trilha.id);
    setCargoFuncaoId("");
    setCargoNovaFuncao("");
    setCargoNome("");
    setNomeEditado(false);
    setCargoNivel(1);
    setCargoRemuneracao("");
    setCargoAdicionais("");
    setCargoDialogOpen(true);
  };

  const openEditCargo = (c: any) => {
    setEditingCargoId(c.id);
    setCargoTrilhaId(c.trilha_id);
    setCargoFuncaoId(c.funcao_id ?? "");
    setCargoNovaFuncao("");
    // O nome atual é preservado — é justamente o que a versão anterior perdia.
    setCargoNome(c.nome);
    setNomeEditado(true);
    setCargoNivel(c.nivel);
    setCargoRemuneracao(String(c.remuneracao));
    setCargoAdicionais(c.adicionais || "");
    setCargoDialogOpen(true);
  };

  const escolherFuncao = (id: string) => {
    setCargoFuncaoId(id);
    if (id !== NOVA_FUNCAO && !editingCargoId) {
      const nivel = proximoNivel(id);
      setCargoNivel(nivel);
      aplicarSugestao(id, nivel, funcaoNome(id));
    }
  };

  const podeSalvar =
    !!cargoFuncaoId &&
    (cargoFuncaoId !== NOVA_FUNCAO || !!cargoNovaFuncao.trim()) &&
    !!cargoNome.trim() &&
    cargoNivel >= 1;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {canManageCargos && <Button onClick={openNewTrilha}><Plus className="mr-2 h-4 w-4" /> Nova Trilha</Button>}
      </div>

      {loadingTrilhas ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : trilhas.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma trilha cadastrada.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {trilhas.map((trilha) => {
            // Níveis de uma mesma função juntos; antes vinha só por nível e
            // intercalava funções (Assistente 1, Coordenador 1, Assistente 2…).
            const trilhaCargos = cargos
              .filter((c: any) => c.trilha_id === trilha.id)
              .sort((a: any, b: any) =>
                funcaoNome(a.funcao_id).localeCompare(funcaoNome(b.funcao_id), "pt-BR")
                || a.nivel - b.nivel
                || Number(a.remuneracao) - Number(b.remuneracao));
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
                      {canManageCargos && (
                        <Button size="sm" variant="outline" onClick={() => openEditTrilha(trilha)}>
                          <Pencil className="mr-1 h-3 w-3" /> Editar Trilha
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteTrilha.mutate(trilha.id)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Excluir Trilha
                        </Button>
                      )}
                      {canManageCargos && (
                        <Button size="sm" onClick={() => openNewCargo(trilha)}>
                          <Plus className="mr-1 h-3 w-3" /> Novo Cargo
                        </Button>
                      )}
                    </div>
                    {trilhaCargos.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Função</TableHead>
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
                              <TableCell className="text-sm text-muted-foreground">{funcaoNome(cargo.funcao_id)}</TableCell>
                              <TableCell>{cargo.nome}</TableCell>
                              <TableCell>{cargo.nivel}</TableCell>
                              <TableCell>{formatCurrency(Number(cargo.remuneracao))}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{cargo.adicionais || "—"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {canManageCargos && (
                                    <Button variant="ghost" size="icon" onClick={() => openEditCargo(cargo)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
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
              <Input value={trilhaNome} onChange={(e) => setTrilhaNome(e.target.value)} placeholder="Ex: Administrativo, Engenharia, Comercial" />
              <p className="text-[11px] text-muted-foreground">
                A trilha é a área. As funções (ex.: Coordenador Administrativo) e seus
                níveis ficam dentro dela. Renomear a trilha não altera o nome dos cargos.
              </p>
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
              <label className="text-sm font-medium">Função *</label>
              <Select value={cargoFuncaoId} onValueChange={escolherFuncao}>
                <SelectTrigger><SelectValue placeholder="Selecione a função…" /></SelectTrigger>
                <SelectContent>
                  {funcoesDaTrilha.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                  <SelectItem value={NOVA_FUNCAO}>+ Nova função</SelectItem>
                </SelectContent>
              </Select>
              {cargoFuncaoId === NOVA_FUNCAO && (
                <Input
                  value={cargoNovaFuncao}
                  onChange={(e) => {
                    setCargoNovaFuncao(e.target.value);
                    aplicarSugestao(NOVA_FUNCAO, cargoNivel, e.target.value.trim());
                  }}
                  placeholder="Ex.: Gerente Administrativo"
                  autoFocus
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do cargo *</label>
              <Input
                value={cargoNome}
                onChange={(e) => { setCargoNome(e.target.value); setNomeEditado(true); }}
                placeholder={nomeFuncaoEscolhida || "Escolha a função"}
              />
              <p className="text-[11px] text-muted-foreground">
                {editingCargoId
                  ? "O nome atual é mantido. Mude só se quiser renomear este cargo."
                  : "Sugerido a partir da função. Você pode ajustar."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nível</label>
                <Input
                  type="number" min={1} value={cargoNivel}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setCargoNivel(n);
                    aplicarSugestao(cargoFuncaoId, n, nomeFuncaoEscolhida);
                  }}
                />
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
            <Button onClick={() => saveCargo.mutate()} disabled={!podeSalvar || saveCargo.isPending}>
              {saveCargo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
