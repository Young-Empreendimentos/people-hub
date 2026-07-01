import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Check, X, MinusCircle, Upload, Loader2, Trash2, Search } from "lucide-react";

type Item = {
  id: string; auditoria_id: string; atividade_id: string;
  status: "pendente" | "positivo" | "inconformidade" | "nao_aplica";
  comentario: string | null; evidencia_url: string | null;
};

type Atividade = {
  id: string; grupo_id: string; nome: string; peso: number;
  grupo_nome: string; grupo_peso: number; grupo_ordem: number; ordem: number;
  metodo_auditoria: string | null;
  normas: string | null; manuais: string | null; indicadores: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  positivo: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inconformidade: "bg-red-100 text-red-800 border-red-200",
  nao_aplica: "bg-slate-100 text-slate-700 border-slate-200",
  pendente: "bg-amber-50 text-amber-800 border-amber-200",
};

export default function AuditoriaExecutar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, canConfig } = useAuth();

  const { data: auditoria, isLoading } = useQuery({
    queryKey: ["rh_auditoria", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_auditorias")
        .select("*, rh_equipes(nome)").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["rh_auditoria_itens", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_auditoria_itens")
        .select("*").eq("auditoria_id", id!);
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["rh_listar_atividades_auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_listar_atividades_auditoria");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const editavel = auditoria
    && auditoria.status === "em_andamento"
    && (auditoria.auditor_user_id === user?.id || canConfig);

  // join atividade x item
  const linhas = useMemo(() => {
    const map = new Map(atividades.map((a) => [a.id, a]));
    return itens
      .map((i) => ({ item: i, atv: map.get(i.atividade_id) }))
      .filter((r): r is { item: Item; atv: Atividade } => !!r.atv)
      .sort((a, b) => (a.atv.grupo_ordem - b.atv.grupo_ordem)
        || a.atv.grupo_nome.localeCompare(b.atv.grupo_nome)
        || (a.atv.ordem - b.atv.ordem)
        || a.atv.nome.localeCompare(b.atv.nome));
  }, [itens, atividades]);

  // Agrupado
  const grupos = useMemo(() => {
    const g = new Map<string, { nome: string; peso: number; itens: typeof linhas }>();
    for (const l of linhas) {
      const k = l.atv.grupo_id;
      if (!g.has(k)) g.set(k, { nome: l.atv.grupo_nome, peso: Number(l.atv.grupo_peso), itens: [] });
      g.get(k)!.itens.push(l);
    }
    return Array.from(g.entries());
  }, [linhas]);

  // Cálculo "ao vivo"
  const calc = useMemo(() => {
    let somaPesoG = 0, somaPesoGxRes = 0;
    const porGrupo: Record<string, { pct: number; avaliado: boolean }> = {};
    for (const [gid, g] of grupos) {
      let num = 0, den = 0;
      for (const l of g.itens) {
        if (l.item.status === "positivo") { num += Number(l.atv.peso); den += Number(l.atv.peso); }
        else if (l.item.status === "inconformidade") { den += Number(l.atv.peso); }
      }
      const pct = den > 0 ? num / den : 0;
      const avaliado = g.itens.some((l) => l.item.status !== "pendente" && l.item.status !== "nao_aplica");
      porGrupo[gid] = { pct, avaliado };
      if (avaliado) { somaPesoG += g.peso; somaPesoGxRes += g.peso * pct; }
    }
    return {
      total: somaPesoG > 0 ? somaPesoGxRes / somaPesoG : 0,
      porGrupo,
      pendentes: linhas.filter((l) => l.item.status === "pendente").length,
    };
  }, [grupos, linhas]);

  const updateItem = useMutation({
    mutationFn: async (payload: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase.from("rh_auditoria_itens")
        .update({ ...payload.patch, avaliado_em: new Date().toISOString() })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh_auditoria_itens", id] }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const finalizar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rh_fechar_auditoria", { p_auditoria_id: id! });
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: (pct) => {
      qc.invalidateQueries({ queryKey: ["rh_auditoria", id] });
      qc.invalidateQueries({ queryKey: ["rh_auditorias"] });
      toast.success(`Auditoria finalizada (${(Number(pct) * 100).toFixed(1)}%).`);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!auditoria) return <p>Auditoria não encontrada.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm"><Link to="/auditorias/lista"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link></Button>
          <h1 className="text-2xl font-bold mt-1">{auditoria.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {auditoria.rh_equipes?.nome ?? "Sem equipe"} • {new Date(auditoria.data_referencia).toLocaleDateString("pt-BR")} • Status: <strong>{auditoria.status}</strong>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Resultado (ao vivo)</p>
          <p className="text-3xl font-bold">{(calc.total * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{calc.pendentes} pendente(s)</p>
        </div>
      </div>

      {editavel && (
        <div className="flex justify-end">
          <Button disabled={calc.pendentes > 0 || finalizar.isPending} onClick={() => { if (confirm("Finalizar a auditoria? Isso congela o resultado.")) finalizar.mutate(); }}>
            {finalizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finalizar auditoria
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {grupos.map(([gid, g]) => (
          <Card key={gid}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">{g.nome}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">peso {g.peso}</Badge>
                  <span className="text-sm font-semibold w-12 text-right">{(calc.porGrupo[gid].pct * 100).toFixed(0)}%</span>
                </div>
              </div>
              <Progress value={calc.porGrupo[gid].pct * 100} className="h-1.5 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              {g.itens.map((l) => (
                <ItemEditor key={l.item.id} item={l.item} atv={l.atv} editavel={!!editavel}
                  onChange={(patch) => updateItem.mutate({ id: l.item.id, patch })} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ItemEditor({ item, atv, editavel, onChange }: {
  item: Item; atv: Atividade; editavel: boolean;
  onChange: (patch: Partial<Item>) => void;
}) {
  const [comentario, setComentario] = useState(item.comentario ?? "");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setComentario(item.comentario ?? ""); }, [item.comentario]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!item.evidencia_url) { setSignedUrl(null); return; }
      const { data } = await supabase.storage.from("auditoria-evidencias")
        .createSignedUrl(item.evidencia_url, 3600);
      if (!cancel) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { cancel = true; };
  }, [item.evidencia_url]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${item.auditoria_id}/${item.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("auditoria-evidencias")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      // Remove evidência anterior
      if (item.evidencia_url && item.evidencia_url !== path) {
        await supabase.storage.from("auditoria-evidencias").remove([item.evidencia_url]);
      }
      onChange({ evidencia_url: path });
      toast.success("Evidência enviada.");
    } catch (e: any) { toast.error("Erro upload: " + e.message); }
    finally { setUploading(false); }
  };

  const removeEvidencia = async () => {
    if (!item.evidencia_url) return;
    if (!confirm("Remover evidência?")) return;
    await supabase.storage.from("auditoria-evidencias").remove([item.evidencia_url]);
    onChange({ evidencia_url: null });
  };

  const onPaste: React.ClipboardEventHandler = async (e) => {
    if (!editavel) return;
    const it = Array.from(e.clipboardData.items).find((x) => x.type.startsWith("image/"));
    if (!it) return;
    const blob = it.getAsFile();
    if (blob) { e.preventDefault(); await uploadFile(blob); }
  };

  const StatusBtn = ({ s, label, icon: Icon }: { s: Item["status"]; label: string; icon: any }) => (
    <Button
      type="button" size="sm"
      variant={item.status === s ? "default" : "outline"}
      className={item.status === s ? STATUS_COLORS[s] + " border" : ""}
      disabled={!editavel}
      onClick={() => onChange({ status: s })}
    >
      <Icon className="mr-1 h-3.5 w-3.5" />{label}
    </Button>
  );

  return (
    <div className="border rounded-lg p-3 space-y-2" onPaste={onPaste}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-medium">{atv.nome}</p>
          <p className="text-xs text-muted-foreground">peso {Number(atv.peso)}</p>
        </div>
        <div className="flex gap-1 flex-wrap">
          <StatusBtn s="positivo" label="Positivo" icon={Check} />
          <StatusBtn s="inconformidade" label="Inconformidade" icon={X} />
          <StatusBtn s="nao_aplica" label="N/A" icon={MinusCircle} />
        </div>
      </div>

      {(atv.metodo_auditoria || atv.normas || atv.manuais || atv.indicadores) && (
        <div className="rounded-md border bg-muted/40 p-2 space-y-1.5 text-xs">
          {atv.metodo_auditoria && (
            <div className="flex gap-1.5 text-amber-800 dark:text-amber-300">
              <Search className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p className="whitespace-pre-line"><span className="font-semibold">Como auditar:</span> {atv.metodo_auditoria}</p>
            </div>
          )}
          {atv.normas && <p className="whitespace-pre-line text-muted-foreground"><span className="font-medium">Normas:</span> {atv.normas}</p>}
          {atv.manuais && <p className="whitespace-pre-line text-muted-foreground"><span className="font-medium">Manuais:</span> {atv.manuais}</p>}
          {atv.indicadores && <p className="whitespace-pre-line text-muted-foreground"><span className="font-medium">Indicadores:</span> {atv.indicadores}</p>}
        </div>
      )}

      <Textarea rows={2} placeholder="Comentário (opcional)…"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        onBlur={() => { if ((item.comentario ?? "") !== comentario) onChange({ comentario: comentario || null }); }}
        disabled={!editavel}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
        {editavel && (
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
            Anexar print
          </Button>
        )}
        {editavel && <span className="text-xs text-muted-foreground">ou cole com Ctrl+V neste cartão</span>}
        {signedUrl && (
          <div className="flex items-center gap-2">
            <a href={signedUrl} target="_blank" rel="noreferrer">
              <img src={signedUrl} alt="Evidência" className="h-16 rounded border" />
            </a>
            {editavel && <Button size="icon" variant="ghost" onClick={removeEvidencia}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        )}
      </div>
    </div>
  );
}
