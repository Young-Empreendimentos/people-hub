import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rhDb } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users, AlertTriangle } from "lucide-react";

/**
 * Indica candidatos do Talents como alternativa externa para a função do plano.
 *
 * Todo externo existe no Talents (decisão de 30/09/2026): a alternativa é um
 * marcador sobre um MAPEAMENTO da função. Por isso, ao escolher alguém:
 *   - já mapeado para esta função → só marca;
 *   - mapeado sem função → o mapeamento recebe esta função e é marcado;
 *   - mapeado para outra função, ou ainda não mapeado → cria um mapeamento
 *     para esta função e marca.
 */
interface TalentsSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  funcaoId: string | null;
  funcaoNome?: string;
  /** Mapeamentos já marcados como alternativa (para não duplicar). */
  mapeamentosMarcados?: string[];
}

interface Opcao {
  key: string; // mapping id, ou "cand:<id>" para quem ainda não tem mapeamento
  candidateId: string;
  mappingId: string | null;
  mappingFuncaoId: string | null;
  nome: string;
  cidade: string | null;
  detalhe: string | null;
  grupo: "esta" | "sem_funcao" | "outra" | "busca";
}

export function TalentsSelectDialog({
  open, onOpenChange, funcaoId, funcaoNome, mapeamentosMarcados = [],
}: TalentsSelectDialogProps) {
  const queryClient = useQueryClient();
  const { user, userName } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: base, isLoading, error: erroCarga } = useQuery({
    queryKey: ["talents_mappings_para_alternativa", funcaoId],
    enabled: open && !!funcaoId,
    queryFn: async () => {
      const [maps, funcoes] = await Promise.all([
        rhDb.from("talents_mappings")
          .select("id, candidate_id, funcao_id, status, especificacao, position_name, notes, talents_candidates(full_name, city, deleted_at)")
          .eq("status", "Ativo"),
        rhDb.from("rh_funcoes").select("id, nome"),
      ]);
      if (maps.error) throw maps.error;
      const nomeFuncao = new Map(((funcoes.data ?? []) as any[]).map((f) => [f.id, f.nome]));
      return ((maps.data ?? []) as any[])
        .filter((m) => !m.talents_candidates?.deleted_at)
        .map((m): Opcao => ({
          key: m.id,
          candidateId: m.candidate_id,
          mappingId: m.id,
          mappingFuncaoId: m.funcao_id,
          nome: m.talents_candidates?.full_name ?? "(sem nome)",
          cidade: m.talents_candidates?.city ?? null,
          detalhe: m.funcao_id
            ? [nomeFuncao.get(m.funcao_id), m.especificacao].filter(Boolean).join(" — ")
            : m.especificacao || m.position_name || "sem função definida",
          grupo: m.funcao_id === funcaoId ? "esta" : m.funcao_id ? "outra" : "sem_funcao",
        }));
    },
  });

  // Busca em todo o Talents, para quem ainda não foi mapeado.
  const termo = search.trim();
  const { data: achados = [] } = useQuery({
    queryKey: ["talents_candidates_busca", termo],
    enabled: open && termo.length >= 2,
    queryFn: async () => {
      const { data, error } = await rhDb.from("talents_candidates")
        .select("id, full_name, city")
        .is("deleted_at", null)
        .ilike("full_name", `%${termo}%`)
        .order("full_name")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const marcados = useMemo(() => new Set(mapeamentosMarcados), [mapeamentosMarcados]);

  const opcoes = useMemo(() => {
    const q = termo.toLowerCase();
    const lista = (base ?? []).filter((o) => !q || o.nome.toLowerCase().includes(q));
    // Quem já tem mapeamento para esta função não precisa aparecer de novo pela busca.
    const comMapeamentoAqui = new Set((base ?? []).filter((o) => o.grupo === "esta").map((o) => o.candidateId));
    const jaListados = new Set(lista.map((o) => o.candidateId));
    const extras = achados
      .filter((c) => !jaListados.has(c.id) && !comMapeamentoAqui.has(c.id))
      .map((c): Opcao => ({
        key: `cand:${c.id}`, candidateId: c.id, mappingId: null, mappingFuncaoId: null,
        nome: c.full_name ?? "(sem nome)", cidade: c.city ?? null, detalhe: "ainda não mapeado", grupo: "busca",
      }));
    const ordem = { esta: 0, sem_funcao: 1, outra: 2, busca: 3 } as const;
    return [...lista, ...extras].sort((a, b) =>
      ordem[a.grupo] - ordem[b.grupo] || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [base, achados, termo]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!funcaoId) throw new Error("Função não definida");
      const escolhidos = opcoes.filter((o) => selected.has(o.key));
      for (const o of escolhidos) {
        let mappingId = o.mappingId;
        if (o.grupo === "sem_funcao" && mappingId) {
          const { error } = await rhDb.from("talents_mappings")
            .update({ funcao_id: funcaoId, updated_at: new Date().toISOString() }).eq("id", mappingId);
          if (error) throw error;
        } else if (o.grupo === "outra" || o.grupo === "busca") {
          const { data, error } = await rhDb.from("talents_mappings").insert({
            candidate_id: o.candidateId,
            funcao_id: funcaoId,
            position_name: funcaoNome ?? null,
            // Sem cidade = vale para qualquer cidade da função (o plano é por função).
            city: null,
            cidade_ibge: null,
            nivel: "forte",
            status: "Ativo",
            notes: "Indicado como alternativa externa no plano de sucessão.",
            mapped_by: user?.email ?? null,
            mapped_by_name: userName ?? user?.email ?? null,
          }).select("id").single();
          if (error) throw error;
          mappingId = (data as any).id;
        }
        const { error } = await rhDb.from("rh_sucessao_externos").insert({ talents_mapping_id: mappingId });
        if (error && (error as any).code !== "23505") throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_sucessao_externos"] });
      queryClient.invalidateQueries({ queryKey: ["talents_mappings_para_alternativa"] });
      toast.success("Alternativas externas adicionadas.");
      handleClose(false);
    },
    onError: (e: any) => {
      queryClient.invalidateQueries({ queryKey: ["rh_sucessao_externos"] });
      toast.error(e?.message ? `Erro ao adicionar: ${e.message}` : "Erro ao adicionar candidatos.");
    },
  });

  const handleClose = (o: boolean) => {
    if (!o) { setSearch(""); setSelected(new Set()); }
    onOpenChange(o);
  };

  const rotuloGrupo: Record<Opcao["grupo"], string> = {
    esta: "Mapeados para esta função",
    sem_funcao: "Mapeados sem função definida — recebem esta função",
    outra: "Mapeados para outras funções — ganham um mapeamento para esta",
    busca: "Outros candidatos do Talents — serão mapeados para esta função",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alternativa externa do Talents</DialogTitle>
          <DialogDescription>
            {funcaoNome ? `Candidatos do Talents para "${funcaoNome}".` : "Selecione candidatos do Talents."}{" "}
            No Talents, eles aparecem como "Forte"; o nível "Alternativa externa" só admin do Pilares vê.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome (inclui quem ainda não foi mapeado)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : erroCarga ? (
            <div className="p-6 text-center text-sm text-destructive">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
              Não foi possível carregar o Talents: {(erroCarga as any).message ?? "erro desconhecido"}
            </div>
          ) : opcoes.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
              {termo.length >= 2
                ? "Ninguém com esse nome no Talents."
                : "Nenhum mapeamento ativo no Talents. Busque pelo nome para indicar qualquer candidato."}
            </div>
          ) : (
            opcoes.map((o, i) => {
              const ja = !!o.mappingId && o.grupo === "esta" && marcados.has(o.mappingId);
              const novoGrupo = i === 0 || opcoes[i - 1].grupo !== o.grupo;
              return (
                <div key={o.key}>
                  {novoGrupo && (
                    <p className="sticky top-0 bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {rotuloGrupo[o.grupo]}
                    </p>
                  )}
                  <label className={`flex items-start gap-3 border-t p-3 ${ja ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}>
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(o.key)}
                      disabled={ja}
                      onCheckedChange={() => toggle(o.key)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{o.nome}</span>
                        {ja && <Badge variant="secondary" className="text-[10px]">já no plano</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[o.detalhe, o.cidade?.trim() || null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </label>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={() => confirmar.mutate()} disabled={selected.size === 0 || confirmar.isPending}>
            {confirmar.isPending ? "Adicionando..." : `Adicionar ${selected.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
