import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
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
import {
  Plus, Trash2, UserPlus, Users, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { TalentsSelectDialog } from "@/components/mapeamento/TalentsSelectDialog";

type Aderencia = "pleno" | "parcial" | "possibilidade";

const ADERENCIA: Record<Aderencia, { label: string; emoji: string; badge: string }> = {
  pleno: { label: "Pleno", emoji: "🟢", badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900" },
  parcial: { label: "Parcial", emoji: "🟡", badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
  possibilidade: { label: "Possibilidade", emoji: "🔵", badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" },
};

interface MappedCargo {
  id: string;
  cargo_id: string;
  cargoNome: string;
  nivel: number;
  trilhaNome: string;
}

interface Alternativa {
  id: string;
  mapeamento_cargo_id: string;
  origem: string;
  nome: string;
  cargo_atual: string | null;
  observacoes: string | null;
  aderencia: Aderencia;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  talents_candidate_id: string | null;
}

export default function MapeamentoAlternativas() {
  const queryClient = useQueryClient();
  const { canManageCargos, canDelete, isAdmin } = useAuth();
  const canManage = canManageCargos;

  const [addCargoOpen, setAddCargoOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState("");

  const [manualOpen, setManualOpen] = useState(false);
  const [manualCargoId, setManualCargoId] = useState<string | null>(null);
  const [mNome, setMNome] = useState("");
  const [mCargoAtual, setMCargoAtual] = useState("");
  const [mObs, setMObs] = useState("");
  const [mAderencia, setMAderencia] = useState<Aderencia>("possibilidade");

  const [talentsOpen, setTalentsOpen] = useState(false);
  const [talentsCargo, setTalentsCargo] = useState<{ id: string; nome: string } | null>(null);

  // --- Queries ---
  const { data: mappedCargos = [], isLoading: loadingCargos } = useQuery({
    queryKey: ["rh_mapeamento_cargos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_mapeamento_cargos")
        .select("id, cargo_id, rh_cargos(id, nome, nivel, trilha_id, rh_trilhas_cargo(nome))");
      if (error) throw error;
      return (data ?? []).map((m: any): MappedCargo => ({
        id: m.id,
        cargo_id: m.cargo_id,
        cargoNome: m.rh_cargos?.nome ?? "(cargo removido)",
        nivel: m.rh_cargos?.nivel ?? 0,
        trilhaNome: m.rh_cargos?.rh_trilhas_cargo?.nome ?? "Sem trilha",
      }));
    },
  });

  const { data: alternativas = [] } = useQuery({
    queryKey: ["rh_mapeamento_alternativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_mapeamento_alternativas")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Alternativa[];
    },
  });

  const { data: allCargos = [] } = useQuery({
    queryKey: ["rh_cargos_com_trilha"],
    enabled: addCargoOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_cargos")
        .select("id, nome, nivel, rh_trilhas_cargo(nome)")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Derivados ---
  const altByCargo = useMemo(() => {
    const map = new Map<string, Alternativa[]>();
    for (const a of alternativas) {
      const arr = map.get(a.mapeamento_cargo_id) ?? [];
      arr.push(a);
      map.set(a.mapeamento_cargo_id, arr);
    }
    return map;
  }, [alternativas]);

  const grouped = useMemo(() => {
    const map = new Map<string, MappedCargo[]>();
    for (const c of mappedCargos) {
      const arr = map.get(c.trilhaNome) ?? [];
      arr.push(c);
      map.set(c.trilhaNome, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [mappedCargos]);

  const total = mappedCargos.length;
  const pct = (aderencia: Aderencia) => {
    if (total === 0) return 0;
    const n = mappedCargos.filter((c) =>
      (altByCargo.get(c.id) ?? []).some((a) => a.aderencia === aderencia)
    ).length;
    return Math.round((n / total) * 100);
  };

  const mappedCargoIds = useMemo(() => new Set(mappedCargos.map((c) => c.cargo_id)), [mappedCargos]);
  const cargoOptions = useMemo(
    () =>
      (allCargos as any[])
        .filter((c) => !mappedCargoIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: `${c.rh_trilhas_cargo?.nome ?? "Sem trilha"} — ${c.nome} (nível ${c.nivel})`,
        })),
    [allCargos, mappedCargoIds]
  );

  // --- Mutations ---
  const addCargo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_mapeamento_cargos").insert({ cargo_id: selectedCargoId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_cargos"] });
      toast.success("Cargo adicionado ao mapeamento.");
      setAddCargoOpen(false);
      setSelectedCargoId("");
    },
    onError: () => toast.error("Erro ao adicionar cargo."),
  });

  const removeCargo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_mapeamento_cargos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_cargos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] });
      toast.success("Cargo removido do mapeamento.");
    },
    onError: () => toast.error("Erro ao remover cargo."),
  });

  const addManual = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_mapeamento_alternativas").insert({
        mapeamento_cargo_id: manualCargoId!,
        origem: "manual",
        nome: mNome.trim(),
        cargo_atual: mCargoAtual.trim() || null,
        observacoes: mObs.trim() || null,
        aderencia: mAderencia,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] });
      toast.success("Candidato adicionado.");
      setManualOpen(false);
    },
    onError: () => toast.error("Erro ao adicionar candidato."),
  });

  const removeAlternativa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_mapeamento_alternativas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] });
      toast.success("Candidato removido.");
    },
    onError: () => toast.error("Erro ao remover candidato."),
  });

  const updateAderencia = useMutation({
    mutationFn: async ({ id, aderencia }: { id: string; aderencia: Aderencia }) => {
      const { error } = await supabase.from("rh_mapeamento_alternativas").update({ aderencia }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] }),
    onError: () => toast.error("Erro ao atualizar aderência."),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rh_aprovar_alternativa", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] });
      toast.success("Aprovação registrada.");
    },
    onError: () => toast.error("Erro ao aprovar (apenas administradores)."),
  });

  const openManual = (cargoId: string) => {
    setManualCargoId(cargoId);
    setMNome(""); setMCargoAtual(""); setMObs(""); setMAderencia("possibilidade");
    setManualOpen(true);
  };

  const openTalents = (cargo: MappedCargo) => {
    setTalentsCargo({ id: cargo.id, nome: `${cargo.cargoNome} (nível ${cargo.nivel})` });
    setTalentsOpen(true);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapeamento de Alternativas</h1>
          <p className="text-sm text-muted-foreground">
            Candidatos externos para possíveis substituições de cargos estratégicos.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddCargoOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar cargo
          </Button>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cargos com candidato 🟢 Pleno</p>
            <p className="text-3xl font-bold">{pct("pleno")}%</p>
            <p className="text-xs text-muted-foreground">de {total} cargo(s) mapeado(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cargos com candidato 🟡 Parcial</p>
            <p className="text-3xl font-bold">{pct("parcial")}%</p>
            <p className="text-xs text-muted-foreground">de {total} cargo(s) mapeado(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      {loadingCargos ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : mappedCargos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum cargo mapeado ainda.
            {canManage && " Clique em \"Adicionar cargo\" para começar."}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={grouped.map(([t]) => t)} className="space-y-2">
          {grouped.map(([trilha, cargos]) => (
            <AccordionItem key={trilha} value={trilha} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{trilha}</span>
                  <span className="text-xs text-muted-foreground">({cargos.length} cargo(s))</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pb-4">
                {cargos.map((cargo) => {
                  const cands = altByCargo.get(cargo.id) ?? [];
                  return (
                    <div key={cargo.id} className="rounded-lg border">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
                        <div>
                          <span className="font-medium">{cargo.cargoNome}</span>
                          <span className="ml-2 text-xs text-muted-foreground">nível {cargo.nivel} · {cands.length} candidato(s)</span>
                        </div>
                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openManual(cargo.id)}>
                              <UserPlus className="mr-1 h-3 w-3" /> Manual
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openTalents(cargo)}>
                              <Users className="mr-1 h-3 w-3" /> Do Talents
                            </Button>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  if (window.confirm(`Remover o cargo "${cargo.cargoNome}" e todos os seus candidatos do mapeamento?`)) {
                                    removeCargo.mutate(cargo.id);
                                  }
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" /> Remover cargo
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {cands.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum candidato cadastrado.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Candidato</TableHead>
                              <TableHead>Cargo atual</TableHead>
                              <TableHead className="w-[170px]">Aderência</TableHead>
                              <TableHead className="w-[230px]">Aprovação</TableHead>
                              <TableHead className="w-16 text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cands.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{a.nome}</span>
                                    {a.origem === "talents" && (
                                      <Badge variant="secondary" className="text-[10px]">Talents</Badge>
                                    )}
                                  </div>
                                  {a.observacoes && (
                                    <p className="text-xs text-muted-foreground">{a.observacoes}</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.cargo_atual || "—"}</TableCell>
                                <TableCell>
                                  {canManage ? (
                                    <Select
                                      value={a.aderencia}
                                      onValueChange={(v) => updateAderencia.mutate({ id: a.id, aderencia: v as Aderencia })}
                                    >
                                      <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {(Object.keys(ADERENCIA) as Aderencia[]).map((k) => (
                                          <SelectItem key={k} value={k}>
                                            {ADERENCIA[k].emoji} {ADERENCIA[k].label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className={ADERENCIA[a.aderencia].badge}>
                                      {ADERENCIA[a.aderencia].emoji} {ADERENCIA[a.aderencia].label}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ApprovalCell
                                    a={a}
                                    isAdmin={isAdmin}
                                    onAprovar={() => aprovar.mutate(a.id)}
                                    aprovando={aprovar.isPending}
                                    formatDate={formatDate}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => removeAlternativa.mutate(a.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Dialog: adicionar cargo */}
      <Dialog open={addCargoOpen} onOpenChange={setAddCargoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar cargo ao mapeamento</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Cargo</label>
            <Combobox
              options={cargoOptions}
              value={selectedCargoId}
              onValueChange={setSelectedCargoId}
              placeholder="Selecione um cargo..."
              searchPlaceholder="Buscar cargo..."
              emptyMessage="Nenhum cargo disponível."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCargoOpen(false)}>Cancelar</Button>
            <Button onClick={() => addCargo.mutate()} disabled={!selectedCargoId || addCargo.isPending}>
              {addCargo.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: cadastro manual */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar candidato (manual)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input value={mNome} onChange={(e) => setMNome(e.target.value)} placeholder="Nome do candidato" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo atual</label>
              <Input value={mCargoAtual} onChange={(e) => setMCargoAtual(e.target.value)} placeholder="Onde atua hoje" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aderência</label>
              <Select value={mAderencia} onValueChange={(v) => setMAderencia(v as Aderencia)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ADERENCIA) as Aderencia[]).map((k) => (
                    <SelectItem key={k} value={k}>{ADERENCIA[k].emoji} {ADERENCIA[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={mObs} onChange={(e) => setMObs(e.target.value)} placeholder="Opcional" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={() => addManual.mutate()} disabled={!mNome.trim() || addManual.isPending}>
              {addManual.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: seleção via Talents */}
      <TalentsSelectDialog
        open={talentsOpen}
        onOpenChange={setTalentsOpen}
        mapeamentoCargoId={talentsCargo?.id ?? null}
        cargoNome={talentsCargo?.nome}
        jaVinculados={
          talentsCargo
            ? (altByCargo.get(talentsCargo.id) ?? [])
                .map((a) => a.talents_candidate_id)
                .filter((x): x is string => !!x)
            : []
        }
      />
    </div>
  );
}

function ApprovalCell({
  a, isAdmin, onAprovar, aprovando, formatDate,
}: {
  a: Alternativa;
  isAdmin: boolean;
  onAprovar: () => void;
  aprovando: boolean;
  formatDate: (iso: string) => string;
}) {
  if (!a.aprovado_em) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={onAprovar} disabled={aprovando}>
            <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
          </Button>
        )}
      </div>
    );
  }

  const vencida = differenceInMonths(new Date(), new Date(a.aprovado_em)) >= 6;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={vencida ? "text-destructive font-medium" : "text-sm"}>
          {formatDate(a.aprovado_em)}
        </span>
        {vencida && (
          <Badge variant="outline" className="border-destructive text-destructive">
            <AlertTriangle className="mr-1 h-3 w-3" /> Vencida
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        por {a.aprovado_por_nome || "administrador"}
      </p>
      {vencida && isAdmin && (
        <Button size="sm" variant="outline" onClick={onAprovar} disabled={aprovando}>
          <RefreshCw className="mr-1 h-3 w-3" /> Revalidar
        </Button>
      )}
    </div>
  );
}
