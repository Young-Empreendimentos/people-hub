import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rhDb, supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CheckCircle2, ExternalLink, Lock, RefreshCw, Trash2, TriangleAlert, Users } from "lucide-react";
import { TalentsSelectDialog } from "@/components/sucessao/TalentsSelectDialog";
import { MESES_VALIDADE_EXTERNO, externoAprovadoValido, vencimentoExterno } from "@/lib/sucessao";

export type Aderencia = "pleno" | "parcial" | "possibilidade";

export const ADERENCIA: Record<Aderencia, { label: string; emoji: string }> = {
  pleno: { label: "Pleno", emoji: "🟢" },
  parcial: { label: "Parcial", emoji: "🟡" },
  possibilidade: { label: "Possibilidade", emoji: "🔵" },
};

const TALENTS_URL = "https://talents.youngempreendimentos.com.br";

/**
 * Marcador de alternativa externa + o mapeamento do Talents a que ele se refere
 * (lido ao vivo: nome, cidade e status vêm do Talents, não de uma cópia).
 */
export interface Externo {
  id: string;
  talents_mapping_id: string;
  aderencia: Aderencia;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  talents_mappings: {
    id: string;
    candidate_id: string;
    funcao_id: string | null;
    status: string | null;
    especificacao: string | null;
    city: string | null;
    notes: string | null;
    talents_candidates: { full_name: string | null; city: string | null } | null;
  } | null;
}

/** Select para trazer o marcador já com o mapeamento e o candidato. */
export const EXTERNO_SELECT =
  "id, talents_mapping_id, aderencia, aprovado_em, aprovado_por_nome, " +
  "talents_mappings!inner(id, candidate_id, funcao_id, status, especificacao, city, notes, talents_candidates(full_name, city))";

/** Conta como cobertura: aprovação válida E mapeamento ativo no Talents. */
export const externoCobre = (e: Pick<Externo, "aprovado_em"> & { talents_mappings: { status: string | null } | null }) =>
  externoAprovadoValido(e.aprovado_em) && (e.talents_mappings?.status ?? "Ativo") === "Ativo";

const fmt = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

/**
 * Candidatos de fora da empresa para a função do plano. Só admin — o marcador
 * é restrito no banco e nunca entra no plano publicado. Todo externo existe no
 * Talents; aqui fica o juízo da sucessão (aderência e aprovação).
 */
export function AlternativasExternas({
  funcaoId, funcaoNome, externos,
}: {
  funcaoId: string | null;
  funcaoNome: string;
  externos: Externo[];
}) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ["rh_sucessao_externos"] });

  const [talentsOpen, setTalentsOpen] = useState(false);
  const [excluir, setExcluir] = useState<Externo | null>(null);

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
    onSuccess: () => { invalidar(); toast.success("Alternativa removida do plano."); setExcluir(null); },
    onError: () => toast.error("Erro ao remover a alternativa."),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 max-w-2xl">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Candidatos do Talents indicados para esta função. Visíveis só para admin e nunca incluídos no
            plano disponibilizado — no Talents, aparecem como "Forte". Com aprovação válida
            ({MESES_VALIDADE_EXTERNO} meses) e mapeamento ativo, cobrem a função <strong>parcialmente</strong>.
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={() => setTalentsOpen(true)} disabled={!funcaoId}>
          <Users className="mr-2 h-4 w-4" />Do Talents
        </Button>
      </div>

      {externos.length === 0 ? (
        <p className="rounded-md border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma alternativa externa para esta função. Use "Do Talents" para indicar candidatos.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Candidato</TableHead>
                <TableHead className="w-[170px]">Aderência</TableHead>
                <TableHead className="min-w-[210px]">Aprovação</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {externos.map((e) => {
                const m = e.talents_mappings;
                const venc = vencimentoExterno(e.aprovado_em);
                const valida = externoAprovadoValido(e.aprovado_em);
                const status = m?.status ?? "Ativo";
                const cidade = m?.city || m?.talents_candidates?.city;
                return (
                  <TableRow key={e.id} className={status !== "Ativo" ? "opacity-70" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`${TALENTS_URL}/candidate/${m?.candidate_id}`}
                          target="_blank" rel="noreferrer"
                          className="font-medium hover:underline inline-flex items-center gap-1"
                          title="Abrir no Talents"
                        >
                          {m?.talents_candidates?.full_name ?? "(candidato removido)"}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                        {status !== "Ativo" && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 text-[10px]">
                            {status} no Talents — não conta
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[m?.especificacao, cidade].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {status === "Contratado" && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Foi contratado: se for o caso, inclua-o como candidato interno.
                        </p>
                      )}
                      {m?.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.notes}</p>}
                    </TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover do plano"
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

      <TalentsSelectDialog
        open={talentsOpen}
        onOpenChange={setTalentsOpen}
        funcaoId={funcaoId}
        funcaoNome={funcaoNome}
        mapeamentosMarcados={externos.map((e) => e.talents_mapping_id)}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover alternativa externa?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.talents_mappings?.talents_candidates?.full_name} sai do plano de {funcaoNome} e a
              aprovação é descartada. No Talents, continua mapeado como "Forte".
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
