import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rhDb } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users, AlertTriangle } from "lucide-react";

interface TalentsSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapeamentoCargoId: string | null;
  cargoNome?: string;
  /** Cargo do mapeamento, para destacar quem o Talents já mapeou para ele. */
  cargoAlvo?: { nome: string; nivel: number } | null;
  /** ids de candidatos do Talents já vinculados a este cargo (para evitar duplicar) */
  jaVinculados?: string[];
  onAdded?: () => void;
}

interface TalentsRow {
  id: string; // id do talents_mappings
  candidate_id: string;
  /** Cargo do Pilares para o qual a pessoa foi mapeada no Talents — o cargo-ALVO. */
  mapeadoPara: string | null;
  mapeadoParaEste: boolean;
  notes: string | null;
  full_name: string;
  city: string | null;
}

export function TalentsSelectDialog({
  open, onOpenChange, mapeamentoCargoId, cargoNome, cargoAlvo, jaVinculados = [], onAdded,
}: TalentsSelectDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // As tabelas do Talents vivem no schema `rh`. Consultar pelo cliente padrão
  // (schema `public`) funcionou até 03/08/2026, quando saiu a view de
  // compatibilidade de `public`; desde então a API respondia PGRST205 e a tela
  // mostrava isso como se fosse falta de acesso.
  const { data: rows = [], isLoading, error: erroCarga } = useQuery({
    queryKey: ["talents_mappings_para_selecao", cargoAlvo?.nome, cargoAlvo?.nivel],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("talents_mappings")
        .select("id, candidate_id, position_id, position_name, notes, talents_candidates(full_name, city)");
      if (error) throw error;
      const lista = (data ?? []) as any[];

      // position_id é um cargo do Pilares (o Talents lista rh_cargos no
      // formulário de mapeamento). Buscamos nome e nível para comparar com o
      // cargo deste mapeamento — por nome+nível, porque o catálogo tem o mesmo
      // cargo repetido por empresa, e o Talents pode ter escolhido outra cópia.
      const ids = [...new Set(lista.map((m) => m.position_id).filter(Boolean))];
      const cargos = new Map<string, { nome: string; nivel: number }>();
      if (ids.length > 0) {
        const { data: cs } = await rhDb.from("rh_cargos").select("id, nome, nivel").in("id", ids);
        for (const c of (cs ?? []) as any[]) cargos.set(c.id, { nome: c.nome, nivel: c.nivel });
      }

      return lista.map((m): TalentsRow => {
        const alvo = m.position_id ? cargos.get(m.position_id) : undefined;
        return {
          id: m.id,
          candidate_id: m.candidate_id,
          mapeadoPara: alvo ? `${alvo.nome} (nível ${alvo.nivel})` : m.position_name ?? null,
          mapeadoParaEste:
            !!alvo && !!cargoAlvo && alvo.nome === cargoAlvo.nome && alvo.nivel === cargoAlvo.nivel,
          notes: m.notes,
          full_name: m.talents_candidates?.full_name ?? "(sem nome)",
          city: m.talents_candidates?.city ?? null,
        };
      });
    },
  });

  const jaSet = useMemo(() => new Set(jaVinculados), [jaVinculados]);

  // Quem o Talents já mapeou para este cargo aparece primeiro.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.full_name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.mapeadoParaEste) - Number(a.mapeadoParaEste)
        || a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [rows, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!mapeamentoCargoId) throw new Error("Cargo não definido");
      const escolhidos = rows.filter((r) => selected.has(r.id));
      const payload = escolhidos.map((r) => ({
        mapeamento_cargo_id: mapeamentoCargoId,
        origem: "talents" as const,
        talents_candidate_id: r.candidate_id,
        talents_mapping_id: r.id,
        nome: r.full_name,
        // Antes ia aqui o position_name do Talents — mas ele é o cargo para o
        // qual a pessoa foi MAPEADA, não o emprego atual dela. O Talents não
        // guarda cargo atual estruturado, então fica em branco.
        cargo_atual: null,
        observacoes: r.notes,
      }));
      const { error } = await rhDb.from("rh_mapeamento_alternativas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_mapeamento_alternativas"] });
      toast.success("Candidatos adicionados do Talents.");
      handleClose(false);
      onAdded?.();
    },
    onError: () => toast.error("Erro ao adicionar candidatos."),
  });

  const handleClose = (o: boolean) => {
    if (!o) { setSearch(""); setSelected(new Set()); }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar do Talents</DialogTitle>
          <DialogDescription>
            {cargoNome ? `Candidatos mapeados no Talents para vincular a "${cargoNome}".` : "Selecione os candidatos mapeados no Talents."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : erroCarga ? (
            // Erro é erro: não confundir com "sem acesso" nem com lista vazia,
            // que foi o que escondeu a quebra por semanas.
            <div className="p-6 text-center text-sm text-destructive">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
              Não foi possível carregar o Talents: {(erroCarga as any).message ?? "erro desconhecido"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
              {rows.length === 0
                ? "Nenhum candidato mapeado no Talents — ou seu usuário não tem acesso ao Talents."
                : "Nenhum candidato encontrado para essa busca."}
            </div>
          ) : (
            filtered.map((r) => {
              const jaAdd = jaSet.has(r.candidate_id);
              return (
                <label
                  key={r.id}
                  className={`flex items-start gap-3 p-3 ${jaAdd ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(r.id)}
                    disabled={jaAdd}
                    onCheckedChange={() => toggle(r.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{r.full_name}</span>
                      {r.mapeadoParaEste && (
                        <Badge variant="secondary" className="text-[10px]">mapeado para este cargo</Badge>
                      )}
                      {jaAdd && <span className="text-xs text-muted-foreground">(já adicionado)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        r.mapeadoPara && !r.mapeadoParaEste ? `mapeado para: ${r.mapeadoPara}` : null,
                        r.city?.trim() || null,
                      ].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={() => confirmar.mutate()}
            disabled={selected.size === 0 || confirmar.isPending}
          >
            {confirmar.isPending ? "Adicionando..." : `Adicionar ${selected.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
