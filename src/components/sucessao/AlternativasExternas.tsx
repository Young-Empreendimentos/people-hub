import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rhDb, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Lock, Pencil, RefreshCw, Trash2, TriangleAlert, UserPlus, Users } from "lucide-react";
import { TalentsSelectDialog } from "@/components/sucessao/TalentsSelectDialog";
import { MESES_VALIDADE_EXTERNO, externoAprovadoValido, vencimentoExterno } from "@/lib/sucessao";

export type Aderencia = "pleno" | "parcial" | "possibilidade";

export const ADERENCIA: Record<Aderencia, { label: string; emoji: string; badge: string }> = {
  pleno: { label: "Pleno", emoji: "🟢", badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900" },
  parcial: { label: "Parcial", emoji: "🟡", badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
  possibilidade: { label: "Possibilidade", emoji: "🔵", badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" },
};

export interface Externo {
  id: string;
  plano_id: string;
  origem: "manual" | "talents";
  nome: string;
  cargo_atual: string | null;
  observacoes: string | null;
  aderencia: Aderencia;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  talents_candidate_id: string | null;
}

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

/**
 * Candidatos de fora da empresa para a função do plano. Só admin — a tabela é
 * restrita no banco e nunca entra no plano publicado, porque o titular e os
 * candidatos internos não devem saber quem está mapeado lá fora.
 *
 * Diferente do interno, o externo não passa pela matriz item × nível (não dá
 * para observá-lo fazendo cada atividade): recebe um juízo geral de aderência.
 * Com aprovação válida, cobre a função parcialmente.
 */
export function AlternativasExternas({
  planoId, funcaoId, funcaoNome, externos,
}: {
  planoId: string;
  funcaoId: string | null;
  funcaoNome: string;
  externos: Externo[];
}) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ["rh_sucessao_externos"] });

  const [form, setForm] = useState<{
    id: string | null; nome: string; cargoAtual: string; obs: string; aderencia: Aderencia;
  } | null>(null);
  const [talentsOpen, setTalentsOpen] = useState(false);
  const [excluir, setExcluir] = useState<Externo | null>(null);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const campos = {
        nome: form.nome.trim(),
        cargo_atual: form.cargoAtual.trim() || null,
        observacoes: form.obs.trim() || null,
        aderencia: form.aderencia,
      };
      const { error } = form.id
        ? await rhDb.from("rh_sucessao_externos").update(campos).eq("id", form.id)
        : await rhDb.from("rh_sucessao_externos").insert({ ...campos, plano_id: planoId, origem: "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast.success(form?.id ? "Alternativa atualizada." : "Alternativa adicionada.");
      setForm(null);
    },
    onError: () => toast.error("Erro ao salvar a alternativa."),
  });

  const mudarAderencia = useMutation({
    mutationFn: async ({ id, aderencia }: { id: string; aderencia: Aderencia }) => {
      const { error } = await rhDb.from("rh_sucessao_externos").update({ aderencia }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: () => toast.error("Erro ao atualizar a aderência."),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rh_sucessao_aprovar_externo" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Aprovação registrada."); },
    onError: () => toast.error("Erro ao aprovar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rhDb.from("rh_sucessao_externos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Alternativa removida."); setExcluir(null); },
    onError: () => toast.error("Erro ao remover a alternativa."),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 max-w-2xl">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Candidatos de fora da empresa. Visíveis só para admin e nunca incluídos no plano
            disponibilizado. Com aprovação válida ({MESES_VALIDADE_EXTERNO} meses), cobrem a
            função <strong>parcialmente</strong>: a cobertura plena continua dependendo de um
            candidato interno apto ou emergencial.
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => setForm({ id: null, nome: "", cargoAtual: "", obs: "", aderencia: "possibilidade" })}
          >
            <UserPlus className="mr-2 h-4 w-4" />Manual
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTalentsOpen(true)}>
            <Users className="mr-2 h-4 w-4" />Do Talents
          </Button>
        </div>
      </div>

      {externos.length === 0 ? (
        <p className="rounded-md border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma alternativa externa mapeada para esta função.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Candidato</TableHead>
                <TableHead className="min-w-[140px]">Cargo atual</TableHead>
                <TableHead className="w-[170px]">Aderência</TableHead>
                <TableHead className="min-w-[200px]">Aprovação</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {externos.map((e) => {
                const venc = vencimentoExterno(e.aprovado_em);
                const valida = externoAprovadoValido(e.aprovado_em);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.nome}</span>
                        {e.origem === "talents" && (
                          <Badge variant="secondary" className="text-[10px]">Talents</Badge>
                        )}
                      </div>
                      {e.observacoes && <p className="text-xs text-muted-foreground">{e.observacoes}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.cargo_atual || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={e.aderencia}
                        onValueChange={(v) => mudarAderencia.mutate({ id: e.id, aderencia: v as Aderencia })}
                      >
                        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ADERENCIA) as Aderencia[]).map((k) => (
                            <SelectItem key={k} value={k}>{ADERENCIA[k].emoji} {ADERENCIA[k].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {!e.aprovado_em ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                          <Button size="sm" variant="outline" onClick={() => aprovar.mutate(e.id)} disabled={aprovar.isPending}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />Aprovar
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={valida ? "text-sm" : "text-sm text-destructive font-medium"}>
                              {fmt(e.aprovado_em)}
                            </span>
                            {valida ? (
                              venc && <span className="text-xs text-muted-foreground">vale até {fmt(venc)}</span>
                            ) : (
                              <Badge variant="outline" className="border-destructive text-destructive">
                                <TriangleAlert className="mr-1 h-3 w-3" />Vencida
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">por {e.aprovado_por_nome || "administrador"}</p>
                          {!valida && (
                            <Button size="sm" variant="outline" onClick={() => aprovar.mutate(e.id)} disabled={aprovar.isPending}>
                              <RefreshCw className="mr-1 h-3 w-3" />Revalidar
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                        onClick={() => setForm({
                          id: e.id, nome: e.nome, cargoAtual: e.cargo_atual ?? "",
                          obs: e.observacoes ?? "", aderencia: e.aderencia,
                        })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover"
                        onClick={() => setExcluir(e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cadastro / edição manual */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar alternativa externa" : "Adicionar alternativa externa"}</DialogTitle>
            <DialogDescription>{funcaoNome}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do candidato" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cargo atual</label>
                <Input value={form.cargoAtual} onChange={(e) => setForm({ ...form, cargoAtual: e.target.value })} placeholder="Onde atua hoje" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Aderência</label>
                <Select value={form.aderencia} onValueChange={(v) => setForm({ ...form, aderencia: v as Aderencia })}>
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
                <Textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="Opcional" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={!form?.nome.trim() || salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TalentsSelectDialog
        open={talentsOpen}
        onOpenChange={setTalentsOpen}
        planoId={planoId}
        cargoNome={funcaoNome}
        funcaoAlvoId={funcaoId}
        jaVinculados={externos.map((e) => e.talents_candidate_id).filter((x): x is string => !!x)}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover alternativa externa?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.nome} sai do plano de {funcaoNome}. Se vier do Talents, o cadastro lá não é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => excluir && remover.mutate(excluir.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
