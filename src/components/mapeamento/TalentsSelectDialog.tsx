import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";

interface TalentsSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapeamentoCargoId: string | null;
  cargoNome?: string;
  /** ids de candidatos do Talents já vinculados a este cargo (para evitar duplicar) */
  jaVinculados?: string[];
  onAdded?: () => void;
}

interface TalentsRow {
  id: string; // id do talents_mappings
  candidate_id: string;
  position_name: string | null;
  notes: string | null;
  full_name: string;
  city: string | null;
  experience: string | null;
}

export function TalentsSelectDialog({
  open, onOpenChange, mapeamentoCargoId, cargoNome, jaVinculados = [], onAdded,
}: TalentsSelectDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["talents_mappings_para_selecao"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talents_mappings")
        .select("id, candidate_id, position_name, notes, talents_candidates(full_name, city, experience)");
      if (error) throw error;
      return (data ?? []).map((m: any): TalentsRow => ({
        id: m.id,
        candidate_id: m.candidate_id,
        position_name: m.position_name,
        notes: m.notes,
        full_name: m.talents_candidates?.full_name ?? "(sem nome)",
        city: m.talents_candidates?.city ?? null,
        experience: m.talents_candidates?.experience ?? null,
      }));
    },
  });

  const jaSet = useMemo(() => new Set(jaVinculados), [jaVinculados]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.full_name.toLowerCase().includes(q));
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
        cargo_atual: r.position_name,
        observacoes: r.notes,
      }));
      const { error } = await supabase.from("rh_mapeamento_alternativas").insert(payload);
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
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
              {rows.length === 0
                ? "Nenhum candidato mapeado disponível no Talents (ou seu usuário não tem acesso ao Talents)."
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
                    <p className="text-sm font-medium truncate">
                      {r.full_name}
                      {jaAdd && <span className="ml-2 text-xs text-muted-foreground">(já adicionado)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[r.position_name, r.city].filter(Boolean).join(" · ") || "—"}
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
