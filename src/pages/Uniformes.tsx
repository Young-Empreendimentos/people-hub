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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Plus, Trash2, Upload, CalendarIcon, ArrowLeft, FileText, Pencil, Shirt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const TAMANHOS = ["P", "M", "G", "GG", "XGG", "G1", "G2", "G3"];
const TIPOS = [
  { value: "polo", label: "Camisa Polo" },
  { value: "social", label: "Camisa Social" },
];
const GENEROS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
];

const BUCKET = "rh-uniformes-recibos";

export default function Uniformes() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/gestao-pessoas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>
        <Shirt className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Controle de Uniformes</h1>
      </div>

      <Tabs defaultValue="estoque" className="space-y-4">
        <TabsList>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="encomendas">Encomendas</TabsTrigger>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque"><EstoqueTab /></TabsContent>
        <TabsContent value="encomendas"><EncomendasTab /></TabsContent>
        <TabsContent value="entregas"><EntregasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================ ESTOQUE ============================
function EstoqueTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState<string>("");

  const { data: estoque = [], isLoading } = useQuery({
    queryKey: ["rh_uniformes_estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_uniformes_estoque" as any)
        .select("*");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) => {
      const { error } = await supabase
        .from("rh_uniformes_estoque" as any)
        .update({ quantidade })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_estoque"] });
      setEditingId(null);
      toast.success("Estoque atualizado.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const grupos = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    for (const tipo of TIPOS) {
      for (const gen of GENEROS) {
        const key = `${tipo.value}__${gen.value}`;
        m[key] = {};
        for (const tam of TAMANHOS) m[key][tam] = null;
      }
    }
    for (const e of estoque) {
      const key = `${e.tipo}__${e.genero}`;
      if (m[key]) m[key][e.tamanho] = e;
    }
    return m;
  }, [estoque]);

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {TIPOS.map((tipo) => (
        <Card key={tipo.value}>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">{tipo.label}</h3>
            {GENEROS.map((gen) => (
              <div key={gen.value} className="space-y-1">
                <p className="text-sm text-muted-foreground">{gen.label}</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {TAMANHOS.map((tam) => {
                    const item = grupos[`${tipo.value}__${gen.value}`][tam];
                    const isEditing = editingId === item?.id;
                    return (
                      <div key={tam} className="border rounded p-2 text-center space-y-1">
                        <div className="text-xs font-medium">{tam}</div>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              value={editQtd}
                              onChange={(e) => setEditQtd(e.target.value)}
                              className="h-7 px-1 text-center"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => update.mutate({ id: item.id, quantidade: Number(editQtd) || 0 })}
                            >✓</Button>
                          </div>
                        ) : (
                          <div
                            className="text-lg font-bold cursor-pointer hover:bg-muted rounded"
                            onClick={() => {
                              setEditingId(item?.id);
                              setEditQtd(String(item?.quantidade ?? 0));
                            }}
                          >
                            {item?.quantidade ?? 0}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================ ENCOMENDAS ============================
function EncomendasTab() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const { funcionarios, isActive } = useActiveEmployees();
  const ativos = useMemo(() => funcionarios.filter((f: any) => isActive(f.id)), [funcionarios, isActive]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [funcId, setFuncId] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [genero, setGenero] = useState("");
  const [qtdSocial, setQtdSocial] = useState("0");
  const [qtdPolo, setQtdPolo] = useState("0");
  const [entregue, setEntregue] = useState(false);
  const [pago, setPago] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const { data: encomendas = [] } = useQuery({
    queryKey: ["rh_uniformes_encomendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_uniformes_encomendas" as any)
        .select("*, rh_funcionarios(nome_completo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setFuncId(""); setEmpreendimento(""); setTamanho(""); setGenero("");
    setQtdSocial("0"); setQtdPolo("0"); setEntregue(false); setPago(false); setObservacoes("");
    setDialogOpen(true);
  };

  const openEdit = (e: any) => {
    setEditing(e);
    setFuncId(e.funcionario_id || "");
    setEmpreendimento(e.empreendimento || "");
    setTamanho(e.tamanho || "");
    setGenero(e.genero || "");
    setQtdSocial(String(e.qtd_camisa_social ?? 0));
    setQtdPolo(String(e.qtd_camisa_polo ?? 0));
    setEntregue(!!e.entregue_funcionario);
    setPago(!!e.pago);
    setObservacoes(e.observacoes || "");
    setDialogOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        funcionario_id: funcId || null,
        empreendimento: empreendimento || null,
        tamanho: tamanho || null,
        genero: genero || null,
        qtd_camisa_social: Number(qtdSocial) || 0,
        qtd_camisa_polo: Number(qtdPolo) || 0,
        entregue_funcionario: entregue,
        pago,
        observacoes: observacoes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("rh_uniformes_encomendas" as any)
          .update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rh_uniformes_encomendas" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_encomendas"] });
      setDialogOpen(false);
      toast.success("Encomenda salva.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_uniformes_encomendas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_encomendas"] });
      toast.success("Excluído.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const toggleField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("rh_uniformes_encomendas" as any)
        .update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rh_uniformes_encomendas"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Encomenda</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Funcionário</TableHead>
            <TableHead>Empreendimento</TableHead>
            <TableHead>Gênero</TableHead>
            <TableHead>Tam.</TableHead>
            <TableHead className="text-center">Social</TableHead>
            <TableHead className="text-center">Polo</TableHead>
            <TableHead className="text-center">Entregue</TableHead>
            <TableHead className="text-center">Pago</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {encomendas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma encomenda.</TableCell></TableRow>
            ) : encomendas.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{e.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{e.empreendimento || "—"}</TableCell>
                <TableCell className="capitalize">{e.genero || "—"}</TableCell>
                <TableCell>{e.tamanho || "—"}</TableCell>
                <TableCell className="text-center">{e.qtd_camisa_social}</TableCell>
                <TableCell className="text-center">{e.qtd_camisa_polo}</TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={e.entregue_funcionario}
                    onCheckedChange={(v) => toggleField.mutate({ id: e.id, field: "entregue_funcionario", value: !!v })} />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox checked={e.pago}
                    onCheckedChange={(v) => toggleField.mutate({ id: e.id, field: "pago", value: !!v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Encomenda</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário</label>
              <Combobox
                options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId} onValueChange={setFuncId} placeholder="Selecione"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Empreendimento</label>
              <Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Gênero</label>
                <Combobox options={GENEROS} value={genero} onValueChange={setGenero} placeholder="Selecione" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tamanho</label>
                <Combobox
                  options={TAMANHOS.map((t) => ({ value: t, label: t }))}
                  value={tamanho} onValueChange={setTamanho} placeholder="Selecione"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Qtd. Camisa Social</label>
                <Input type="number" value={qtdSocial} onChange={(e) => setQtdSocial(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Qtd. Camisa Polo</label>
                <Input type="number" value={qtdPolo} onChange={(e) => setQtdPolo(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={entregue} onCheckedChange={(v) => setEntregue(!!v)} />
                Entregue ao funcionário
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={pago} onCheckedChange={(v) => setPago(!!v)} />
                Pago
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================ ENTREGAS ============================
function EntregasTab() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const { funcionarios, isActive } = useActiveEmployees();
  const ativos = useMemo(() => funcionarios.filter((f: any) => isActive(f.id)), [funcionarios, isActive]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [funcId, setFuncId] = useState("");
  const [tipo, setTipo] = useState("");
  const [genero, setGenero] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [dataEntrega, setDataEntrega] = useState<Date | undefined>(new Date());
  const [observacoes, setObservacoes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [devDialog, setDevDialog] = useState<any>(null);
  const [dataDevolucao, setDataDevolucao] = useState<Date | undefined>(new Date());

  const { data: entregas = [] } = useQuery({
    queryKey: ["rh_uniformes_entregas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_uniformes_entregas" as any)
        .select("*, rh_funcionarios(nome_completo)")
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const openNew = () => {
    setFuncId(""); setTipo(""); setGenero(""); setTamanho(""); setQuantidade("1");
    setDataEntrega(new Date()); setObservacoes(""); setFile(null);
    setDialogOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!funcId || !tipo || !genero || !tamanho || !dataEntrega || !file) {
        throw new Error("Preencha todos os campos e anexe o recibo.");
      }
      const path = `entregas/${funcId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("rh_uniformes_entregas" as any).insert({
        funcionario_id: funcId,
        tipo, genero, tamanho,
        quantidade: Number(quantidade) || 1,
        data_entrega: format(dataEntrega, "yyyy-MM-dd"),
        recibo_path: path,
        observacoes: observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_entregas"] });
      setDialogOpen(false);
      toast.success("Entrega registrada.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const devolver = useMutation({
    mutationFn: async () => {
      if (!devDialog || !dataDevolucao) return;
      const { error } = await supabase.from("rh_uniformes_entregas" as any).update({
        devolvido: true,
        data_devolucao: format(dataDevolucao, "yyyy-MM-dd"),
      }).eq("id", devDialog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_entregas"] });
      setDevDialog(null);
      toast.success("Devolução registrada.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const remove = useMutation({
    mutationFn: async (e: any) => {
      if (e.recibo_path) await supabase.storage.from(BUCKET).remove([e.recibo_path]);
      const { error } = await supabase.from("rh_uniformes_entregas" as any).delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_uniformes_entregas"] });
      toast.success("Excluído.");
    },
    onError: (e: any) => toast.error(e.message || "Erro."),
  });

  const openRecibo = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Erro ao abrir recibo."); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Registrar Entrega</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Funcionário</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Gênero</TableHead>
            <TableHead>Tam.</TableHead>
            <TableHead className="text-center">Qtd</TableHead>
            <TableHead>Recibo</TableHead>
            <TableHead>Devolução</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {entregas.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma entrega.</TableCell></TableRow>
            ) : entregas.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{format(new Date(e.data_entrega + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell>{e.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{e.tipo === "polo" ? "Polo" : "Social"}</TableCell>
                <TableCell className="capitalize">{e.genero}</TableCell>
                <TableCell>{e.tamanho}</TableCell>
                <TableCell className="text-center">{e.quantidade}</TableCell>
                <TableCell>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openRecibo(e.recibo_path)}>
                    <FileText className="h-3 w-3 mr-1" /> Ver
                  </Button>
                </TableCell>
                <TableCell>
                  {e.devolvido ? (
                    <Badge variant="secondary">
                      Devolvido {e.data_devolucao && format(new Date(e.data_devolucao + "T00:00:00"), "dd/MM/yyyy")}
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => { setDevDialog(e); setDataDevolucao(new Date()); }}>
                      Registrar devolução
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(e)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registrar Entrega</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário (ativos) *</label>
              <Combobox
                options={ativos.map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId} onValueChange={setFuncId} placeholder="Selecione"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo *</label>
                <Combobox options={TIPOS} value={tipo} onValueChange={setTipo} placeholder="Selecione" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Gênero *</label>
                <Combobox options={GENEROS} value={genero} onValueChange={setGenero} placeholder="Selecione" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tamanho *</label>
                <Combobox
                  options={TAMANHOS.map((t) => ({ value: t, label: t }))}
                  value={tamanho} onValueChange={setTamanho} placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Qtd *</label>
                <Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dataEntrega && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataEntrega ? format(dataEntrega, "dd/MM/yyyy") : "—"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataEntrega} onSelect={setDataEntrega} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Recibo (anexo) *</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> Selecionar
                </Button>
                <span className="text-sm text-muted-foreground truncate">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!devDialog} onOpenChange={(o) => !o && setDevDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data da devolução *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataDevolucao ? format(dataDevolucao, "dd/MM/yyyy") : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dataDevolucao} onSelect={setDataDevolucao} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevDialog(null)}>Cancelar</Button>
            <Button onClick={() => devolver.mutate()} disabled={devolver.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
