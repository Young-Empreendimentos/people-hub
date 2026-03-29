import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

export default function Admissoes() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterFunc, setFilterFunc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [funcId, setFuncId] = useState("");
  const [tipo, setTipo] = useState("admissao");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["rh_admissoes_desligamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*, rh_funcionarios(nome_completo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      let anexo_name: string | null = null;
      if (file) {
        const path = `admissoes/${funcId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_path = path;
        anexo_name = file.name;
      }
      const { error } = await supabase.from("rh_admissoes_desligamentos").insert({
        funcionario_id: funcId,
        tipo,
        data,
        observacoes: obs || null,
        anexo_path,
        anexo_name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_admissoes_desligamentos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_status_funcionarios"] });
      toast.success("Registro salvo.");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar registro."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_path: string | null }) => {
      if (r.anexo_path) await supabase.storage.from("rh-anexos").remove([r.anexo_path]);
      const { error } = await supabase.from("rh_admissoes_desligamentos").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_admissoes_desligamentos"] });
      toast.success("Registro excluído.");
    },
    onError: () => toast.error("Erro ao excluir registro."),
  });

  const openNew = () => {
    setFuncId(""); setTipo("admissao"); setData(""); setObs(""); setFile(null);
    setDialogOpen(true);
  };

  const filtered = filterFunc
    ? registros.filter((r: any) => r.funcionario_id === filterFunc)
    : registros;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admissões e Desligamentos</h1>
          <p className="text-muted-foreground">Registre admissões e desligamentos de colaboradores.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Registro</Button>
      </div>

      <div className="max-w-sm">
        <Combobox
          options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo }))}
          value={filterFunc}
          onValueChange={setFilterFunc}
          placeholder="Filtrar por funcionário"
          searchPlaceholder="Buscar funcionário..."
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.data}</TableCell>
                  <TableCell className="font-medium">{r.rh_funcionarios?.nome_completo || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.tipo === "admissao" ? "default" : "destructive"}>
                      {r.tipo === "admissao" ? "Admissão" : "Desligamento"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.observacoes || "—"}</TableCell>
                  <TableCell>{r.anexo_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Registro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário *</label>
              <Combobox
                options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId}
                onValueChange={setFuncId}
                placeholder="Selecione o funcionário"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo *</label>
                <Combobox
                  options={[
                    { value: "admissao", label: "Admissão" },
                    { value: "desligamento", label: "Desligamento" },
                  ]}
                  value={tipo}
                  onValueChange={setTipo}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data *</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Anexo ({tipo === "admissao" ? "Contrato de Trabalho" : "Aviso"})
              </label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> Selecionar arquivo
                </Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !data || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
