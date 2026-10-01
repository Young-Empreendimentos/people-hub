import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { rhDb } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Seletor de cidade sobre a base do IBGE (rh.rh_municipios, 5.571 municípios).
 * Busca no servidor — carregar a lista inteira num combobox travaria. O valor é
 * o código IBGE; o nome sozinho não identifica (232 nomes se repetem entre UFs).
 * RS aparece primeiro: é onde a empresa atua.
 */

export const normalizarBusca = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();

export interface Municipio { codigo_ibge: number; nome: string; uf: string }
export const rotuloCidade = (m?: Municipio | null) => (m ? `${m.nome}/${m.uf}` : "");

export function useMunicipio(codigo?: number | null) {
  return useQuery({
    queryKey: ["rh_municipio", codigo],
    enabled: !!codigo,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await rhDb.from("rh_municipios" as any).select("codigo_ibge, nome, uf").eq("codigo_ibge", codigo).maybeSingle();
      return (data ?? null) as unknown as Municipio | null;
    },
  });
}

export function CidadeSelect({
  value, onChange, placeholder = "Selecione a cidade", disabled, className, allowClear = false,
}: {
  value: number | null | undefined;
  onChange: (codigo: number | null, municipio: Municipio | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [termo, setTermo] = React.useState("");
  const { data: atual } = useMunicipio(value ?? null);
  const t = normalizarBusca(termo);

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["rh_municipios_busca", t],
    enabled: open && t.length >= 2,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await rhDb.from("rh_municipios" as any)
        .select("codigo_ibge, nome, uf").ilike("nome_busca", `%${t}%`).limit(40);
      if (error) throw error;
      const lista = (data ?? []) as unknown as Municipio[];
      // RS primeiro; depois quem começa com o termo; depois alfabético.
      return lista.sort((a, b) =>
        Number(b.uf === "RS") - Number(a.uf === "RS")
        || Number(normalizarBusca(b.nome).startsWith(t)) - Number(normalizarBusca(a.nome).startsWith(t))
        || a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTermo(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}>
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? rotuloCidade(atual) || "…" : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {allowClear && value && !disabled && (
              <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onChange(null, null); }} />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[240px] p-0 pointer-events-auto z-[60]" align="start"
        onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite o nome da cidade..." value={termo} onValueChange={setTermo} />
          <CommandList>
            <CommandEmpty>
              {t.length < 2 ? "Digite pelo menos 2 letras." : isFetching ? "Buscando..." : "Nenhuma cidade encontrada."}
            </CommandEmpty>
            <CommandGroup>
              {resultados.map((m) => (
                <CommandItem key={m.codigo_ibge} value={String(m.codigo_ibge)}
                  onSelect={() => { onChange(m.codigo_ibge, m); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.codigo_ibge ? "opacity-100" : "opacity-0")} />
                  {m.nome}<span className="ml-1 text-muted-foreground">/{m.uf}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
