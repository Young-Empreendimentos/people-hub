import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";

export default function Avaliacoes() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterFunc, setFilterFunc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [funcId, setFuncId] = useState("");
  const [avaliadorId, setAvaliadorId] = useState("");
  const [dataAvaliacao, setDataAvaliacao] = useState("");
  const [resultados, setResultados] = useState(3);
  const [valores, setValores] = useState(3);
  const [metas, setMetas] = useState("");
  const [auditorias, setAuditorias] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ["rh_avaliacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_avaliacoes")
        .select("*, funcionario:rh_funcionarios!rh_avaliacoes_funcionario_id_fkey(nome_completo), avaliador:rh_funcionarios!rh_avaliacoes_avaliador_id_fkey(nome_completo)")
        .order("data_avaliacao", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => { const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo"); return data || []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      let anexo_name: string | null = null;
      if (file) {
        const path = `avaliacoes/${funcId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_path = path; anexo_name = file.name;
      }
      const { error } = await supabase.from("rh_avaliacoes").insert({
        funcionario_id: funcId,
        avaliador_id: avaliadorId || null,
        data_avaliacao: dataAvaliacao,
        pontuacao_resultados: resultados,
        pontuacao_valores: valores,
        pontuacao_metas: parseFloat(metas) || 0,
        pontuacao_auditorias: parseFloat(auditorias) || 0,
        anexo_path, anexo_name,
        observacoes: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_avaliacoes"] });
      toast.success("Avaliação registrada.");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar avaliação."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_path: string | null }) => {
      if (r.anexo_path) await supabase.storage.from("rh-anexos").remove([r.anexo_path]);
      const { error } = await supabase.from("rh_avaliacoes").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_avaliacoes"] }); toast.success("Avaliação excluída."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setFuncId(""); setAvaliadorId(""); setDataAvaliacao(""); setResultados(3);
    setValores(3); setMetas(""); setAuditorias(""); setObs(""); setFile(null);
    setDialogOpen(true);
  };

  const filtered = filterFunc ? avaliacoes.filter((a: any) => a.funcionario_id === filterFunc) : avaliacoes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground">Registre e acompanhe avaliações de desempenho.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Avaliação</Button>
      </div>

      <div className="max-w-sm">
        <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Avaliado</TableHead><TableHead>Avaliador</TableHead>
            <TableHead>Result.</TableHead><TableHead>Valores</TableHead><TableHead>Metas</TableHead><TableHead>Audit.</TableHead>
            <TableHead className="w-16 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma avaliação.</TableCell></TableRow>
            : filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.data_avaliacao}</TableCell>
                <TableCell className="font-medium">{a.funcionario?.nome_completo || "—"}</TableCell>
                <TableCell>{a.avaliador?.nome_completo || "—"}</TableCell>
                <TableCell>{a.pontuacao_resultados}/5</TableCell>
                <TableCell>{a.pontuacao_valores}/5</TableCell>
                <TableCell>{Number(a.pontuacao_metas).toFixed(0)}%</TableCell>
                <TableCell>{Number(a.pontuacao_auditorias).toFixed(0)}%</TableCell>
                <TableCell className="text-right">
                  {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Avaliado *</label>
                <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione" />
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Avaliador</label>
                <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={avaliadorId} onValueChange={setAvaliadorId} placeholder="Selecione" />
              </div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Data *</label><Input type="date" value={dataAvaliacao} onChange={(e) => setDataAvaliacao(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Resultados (1-5)</label><Input type="number" min={1} max={5} value={resultados} onChange={(e) => setResultados(Number(e.target.value))} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Valores (1-5)</label><Input type="number" min={1} max={5} value={valores} onChange={(e) => setValores(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Metas (0-100%)</label><Input type="number" min={0} max={100} step="0.01" value={metas} onChange={(e) => setMetas(e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Auditorias (0-100%)</label><Input type="number" min={0} max={100} step="0.01" value={auditorias} onChange={(e) => setAuditorias(e.target.value)} placeholder="0" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Anexo (documento físico)</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-3 w-3" /> Selecionar</Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !dataAvaliacao || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
