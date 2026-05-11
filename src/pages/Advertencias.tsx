import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, FileText, Trash2, Upload, CalendarIcon, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function Advertencias() {
  const queryClient = useQueryClient();
  const { canDelete, role } = useAuth();
  const canEdit = role === "admin" || role === "coordenador";
  const { funcionarios, isActive, isLoading } = useActiveEmployees();
  const ativos = useMemo(() => funcionarios.filter((f: any) => isActive(f.id)), [funcionarios, isActive]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [funcId, setFuncId] = useState("");
  const [data, setData] = useState<Date | undefined>(new Date());
  const [tipo, setTipo] = useState<"Verbal" | "Formal" | "">("");
  const [motivo, setMotivo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const { data: advertencias = [] } = useQuery({
    queryKey: ["rh_advertencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_advertencias")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const countByFunc = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of advertencias as any[]) m[a.funcionario_id] = (m[a.funcionario_id] || 0) + 1;
    return m;
  }, [advertencias]);

  const advByFunc = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const a of advertencias as any[]) {
      if (!m[a.funcionario_id]) m[a.funcionario_id] = [];
      m[a.funcionario_id].push(a);
    }
    return m;
  }, [advertencias]);

  const filteredAtivos = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return ativos;
    return ativos.filter((f: any) => f.nome_completo?.toLowerCase().includes(s));
  }, [ativos, search]);

  const openNew = () => {
    setFuncId(""); setData(new Date()); setTipo(""); setMotivo(""); setFile(null);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!funcId || !data || !tipo || !motivo.trim()) {
        throw new Error("Preencha todos os campos.");
      }
      if (tipo === "Formal" && !file) {
        throw new Error("Para advertência Formal, o anexo PDF é obrigatório.");
      }
      let arquivo_url: string | null = null;
      if (file) {
        const path = `advertencias/${funcId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (upErr) throw upErr;
        arquivo_url = path;
      }
      const { error } = await supabase.from("rh_advertencias").insert({
        funcionario_id: funcId,
        data: format(data, "yyyy-MM-dd"),
        tipo,
        motivo: motivo.trim(),
        arquivo_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_advertencias"] });
      toast.success("Advertência registrada.");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (a: any) => {
      if (a.arquivo_url) {
        await supabase.storage.from("rh-anexos").remove([a.arquivo_url]);
      }
      const { error } = await supabase.from("rh_advertencias").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_advertencias"] });
      toast.success("Advertência excluída.");
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("rh-anexos").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao abrir arquivo."); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/gestao-pessoas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Advertências</h1>
        </div>
        {canEdit && (
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Registrar Nova Advertência</Button>
        )}
      </div>

      <Input
        placeholder="Buscar funcionário..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead className="w-32">Advertências</TableHead>
            <TableHead className="w-32 text-right">Histórico</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filteredAtivos.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum funcionário ativo.</TableCell></TableRow>
            ) : filteredAtivos.map((f: any) => {
              const count = countByFunc[f.id] || 0;
              const isOpen = expanded[f.id];
              const list = advByFunc[f.id] || [];
              return (
                <React.Fragment key={f.id}>
                  <TableRow>
                    <TableCell>
                      {count > 0 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded((p) => ({ ...p, [f.id]: !p[f.id] }))}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{f.nome_completo}</TableCell>
                    <TableCell>
                      <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={count === 0} onClick={() => setExpanded((p) => ({ ...p, [f.id]: !p[f.id] }))}>
                        Histórico
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen && list.length > 0 && (
                    <TableRow key={f.id + "-exp"} className="bg-muted/30">
                      <TableCell colSpan={4} className="p-0">
                        <div className="px-6 py-3">
                          <Table>
                            <TableHeader><TableRow>
                              <TableHead className="w-28">Data</TableHead>
                              <TableHead className="w-24">Tipo</TableHead>
                              <TableHead>Motivo</TableHead>
                              <TableHead className="w-28">PDF</TableHead>
                              {canDelete && <TableHead className="w-16"></TableHead>}
                            </TableRow></TableHeader>
                            <TableBody>
                              {list.map((a) => (
                                <TableRow key={a.id}>
                                  <TableCell>{format(new Date(a.data + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                                  <TableCell>
                                    <Badge variant={a.tipo === "Formal" ? "destructive" : "secondary"}>{a.tipo}</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{a.motivo}</TableCell>
                                  <TableCell>
                                    {a.arquivo_url ? (
                                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openFile(a.arquivo_url)}>
                                        <FileText className="h-3 w-3 mr-1" /> Ver
                                      </Button>
                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                  </TableCell>
                                  {canDelete && (
                                    <TableCell>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(a)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Advertência</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário *</label>
              <Combobox
                options={ativos.map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId}
                onValueChange={setFuncId}
                placeholder="Selecione"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !data && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {data ? format(data, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={data} onSelect={setData} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo *</label>
                <Combobox
                  options={[{ value: "Verbal", label: "Verbal" }, { value: "Formal", label: "Formal" }]}
                  value={tipo}
                  onValueChange={(v) => setTipo(v as any)}
                  placeholder="Selecione"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo * <span className="text-xs text-muted-foreground">({motivo.length}/250)</span></label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 250))} maxLength={250} rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Anexo PDF {tipo === "Formal" && <span className="text-destructive">*</span>}
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> Selecionar
                </Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              {tipo === "Formal" && !file && (
                <p className="text-xs text-destructive">PDF obrigatório para advertência Formal.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
