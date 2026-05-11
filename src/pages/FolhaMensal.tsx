import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function FolhaMensal() {
  const queryClient = useQueryClient();
  const { canDelete, role } = useAuth();
  const { isActive } = useActiveEmployees();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterFunc, setFilterFunc] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterDataIni, setFilterDataIni] = useState<Date | undefined>(undefined);
  const [filterDataFim, setFilterDataFim] = useState<Date | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const [dialogEmpresaId, setDialogEmpresaId] = useState("");
  const [funcId, setFuncId] = useState("");
  const [mesRef, setMesRef] = useState("");
  const [horasAtraso, setHorasAtraso] = useState("");
  const [horasExtra, setHorasExtra] = useState("");
  const [planoSaude, setPlanoSaude] = useState("");
  const [descontoParque, setDescontoParque] = useState("");
  const [auxilioEdu, setAuxilioEdu] = useState(false);
  const [descontos, setDescontos] = useState("");
  const [comissoes, setComissoes] = useState("");
  const [plr, setPlr] = useState("");
  const [obs, setObs] = useState("");
  const [vrDesconsiderado, setVrDesconsiderado] = useState(false);
  const [vrJustificativa, setVrJustificativa] = useState("");
  const [valorVr, setValorVr] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Lista de descontos (tipo + valor)
  const TIPOS_DESCONTO = [
    "Plano de Saúde",
    "Parque da Guarda",
    "Danos Patrimoniais",
    "Horas Falta",
    "Reembolso de Aluguel",
    "Gastos no Cartão Corporativo",
  ];
  type DescontoItem = { id?: string; tipo: string; valor: string; observacao: string };
  const [descontosLista, setDescontosLista] = useState<DescontoItem[]>([]);
  const [novoDescontoTipo, setNovoDescontoTipo] = useState("");
  const [novoDescontoValor, setNovoDescontoValor] = useState("");
  const [novoDescontoObs, setNovoDescontoObs] = useState("");
  const addDescontoItem = () => {
    const v = parseFloat(novoDescontoValor);
    if (!novoDescontoTipo || isNaN(v) || v <= 0) {
      toast.error("Selecione o tipo e informe um valor válido.");
      return;
    }
    setDescontosLista((arr) => [...arr, { tipo: novoDescontoTipo, valor: String(v), observacao: novoDescontoObs }]);
    setNovoDescontoTipo("");
    setNovoDescontoValor("");
    setNovoDescontoObs("");
  };
  const removeDescontoItem = (idx: number) => {
    setDescontosLista((arr) => arr.filter((_, i) => i !== idx));
  };

  // Lista de reembolsos manuais
  const TIPOS_REEMBOLSO = ["Gratificação", "Reembolso de Aluguel", "Auxílio Moradia", "Outro"];
  type ReembolsoItem = { id?: string; tipo: string; valor: string; observacao: string };
  const [reembolsosLista, setReembolsosLista] = useState<ReembolsoItem[]>([]);
  const [novoReembolsoTipo, setNovoReembolsoTipo] = useState("");
  const [novoReembolsoValor, setNovoReembolsoValor] = useState("");
  const [novoReembolsoObs, setNovoReembolsoObs] = useState("");
  const addReembolsoItem = () => {
    const v = parseFloat(novoReembolsoValor);
    if (!novoReembolsoTipo || isNaN(v) || v <= 0) {
      toast.error("Selecione o tipo e informe um valor válido.");
      return;
    }
    setReembolsosLista((arr) => [...arr, { tipo: novoReembolsoTipo, valor: String(v), observacao: novoReembolsoObs }]);
    setNovoReembolsoTipo("");
    setNovoReembolsoValor("");
    setNovoReembolsoObs("");
  };
  const removeReembolsoItem = (idx: number) => {
    setReembolsosLista((arr) => arr.filter((_, i) => i !== idx));
  };

  const VR_CLT_VALOR = 300;

  const { data: folhas = [], isLoading } = useQuery({
    queryKey: ["rh_folha_mensal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_folha_mensal")
        .select("*, rh_funcionarios(nome_completo, empresa_id)")
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionariosAll = [] } = useQuery({
    queryKey: ["rh_funcionarios_folha"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo, empresa_id, cargo_id, tipo_contrato").order("nome_completo");
      return data || [];
    },
  });
  const funcionarios = useMemo(() => funcionariosAll.filter((f: any) => isActive(f.id)), [funcionariosAll, isActive]);

  const MESES_PT = [
    { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" }, { value: "04", label: "Abril" },
    { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
    { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];
  const anoAtual = new Date().getFullYear();
  const ANOS_OPTS = Array.from({ length: 11 }, (_, i) => {
    const a = String(anoAtual - 5 + i);
    return { value: a, label: a };
  });
  const mesPart = mesRef ? mesRef.slice(5, 7) : "";
  const anoPart = mesRef ? mesRef.slice(0, 4) : "";
  const setMesPart = (m: string) => {
    const a = anoPart || String(anoAtual);
    setMesRef(m ? `${a}-${m}` : "");
  };
  const setAnoPart = (a: string) => {
    const m = mesPart || "01";
    setMesRef(a ? `${a}-${m}` : "");
  };

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos_folha"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_cargos").select("id, remuneracao, nome, nivel");
      return data || [];
    },
  });
  const cargoMap = useMemo(() => {
    const m: Record<string, { remuneracao: number; nome: string; nivel: number | null }> = {};
    for (const c of cargos as any[]) m[c.id] = { remuneracao: Number(c.remuneracao) || 0, nome: c.nome, nivel: c.nivel ?? null };
    return m;
  }, [cargos]);

  const selectedFuncCargo = useMemo(() => {
    const f = funcionariosAll.find((x: any) => x.id === funcId) as any;
    if (!f?.cargo_id) return null;
    return cargoMap[f.cargo_id] || null;
  }, [funcId, funcionariosAll, cargoMap]);

  const selectedFuncTipoContrato = useMemo(() => {
    const f = funcionariosAll.find((x: any) => x.id === funcId) as any;
    return f?.tipo_contrato || null;
  }, [funcId, funcionariosAll]);

  const vrCalculado = useMemo(() => {
    if (vrDesconsiderado) return 0;
    const editado = parseFloat(valorVr);
    if (!isNaN(editado)) return editado;
    return selectedFuncTipoContrato === "CLT" ? VR_CLT_VALOR : 0;
  }, [selectedFuncTipoContrato, vrDesconsiderado, valorVr]);

  // Quando seleciona funcionário em nova folha, preenche VR padrão
  useEffect(() => {
    if (!editingId && funcId) {
      const padrao = selectedFuncTipoContrato === "CLT" ? VR_CLT_VALOR : 0;
      setValorVr(String(padrao));
    }
  }, [funcId, selectedFuncTipoContrato, editingId]);

  // Quando marca/desmarca desconsiderar VR, ajusta valor
  useEffect(() => {
    if (editingId) return;
    if (vrDesconsiderado) {
      setValorVr("0");
    } else {
      const padrao = selectedFuncTipoContrato === "CLT" ? VR_CLT_VALOR : 0;
      setValorVr(String(padrao));
    }
  }, [vrDesconsiderado, editingId, selectedFuncTipoContrato]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["rh_empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_empresas").select("id, nome");
      return data || [];
    },
  });

  const { data: aditivos = [] } = useQuery({
    queryKey: ["rh_aditivos_empresas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_aditivos")
        .select("funcionario_id, empresa_final_id, data")
        .not("empresa_final_id", "is", null)
        .order("data", { ascending: true });
      return data || [];
    },
  });

  const empresaMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of empresas) map[e.id] = e.nome;
    return map;
  }, [empresas]);

  // Build per-employee timeline of empresa changes from aditivos
  const aditivosByFunc = useMemo(() => {
    const map: Record<string, { data: string; empresa_final_id: string }[]> = {};
    for (const a of aditivos as any[]) {
      if (!map[a.funcionario_id]) map[a.funcionario_id] = [];
      map[a.funcionario_id].push({ data: a.data, empresa_final_id: a.empresa_final_id });
    }
    return map;
  }, [aditivos]);

  const getEmpresaAtDate = (funcIdVal: string, dateStr: string): string | null => {
    // Find the employee's original empresa
    const func = funcionariosAll.find((f: any) => f.id === funcIdVal) as any;
    let empresaId = func?.empresa_id || null;

    // Apply aditivos in chronological order up to the given date
    const timeline = aditivosByFunc[funcIdVal];
    if (timeline) {
      for (const entry of timeline) {
        if (entry.data <= dateStr) {
          empresaId = entry.empresa_final_id;
        } else {
          break;
        }
      }
    }
    return empresaId;
  };

  const getEmpresaNome = (funcIdVal: string, dateStr: string): string => {
    const empresaId = getEmpresaAtDate(funcIdVal, dateStr);
    return empresaId ? (empresaMap[empresaId] || "—") : "—";
  };

  // Current empresa for the dialog (based on selected func + mesRef)
  const dialogEmpresa = useMemo(() => {
    if (!funcId) return "—";
    // For new entries or current date reference
    const date = mesRef ? mesRef + "-28" : new Date().toISOString().slice(0, 10);
    return getEmpresaNome(funcId, date);
  }, [funcId, mesRef, funcionarios, aditivosByFunc, empresaMap]);

  // Ciclo de RH: dia 20 do mês anterior ao dia 19 do mês de referência
  const cicloRange = useMemo(() => {
    if (!mesRef) return null;
    const [y, m] = mesRef.split("-").map(Number);
    const ini = new Date(y, m - 2, 20); // mês anterior dia 20
    const fim = new Date(y, m - 1, 19); // mês atual dia 19
    return { ini: format(ini, "yyyy-MM-dd"), fim: format(fim, "yyyy-MM-dd") };
  }, [mesRef]);

  const { data: advertenciasCiclo = [] } = useQuery({
    queryKey: ["rh_advertencias_ciclo", funcId, cicloRange?.ini, cicloRange?.fim],
    enabled: !!funcId && !!cicloRange,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_advertencias")
        .select("id, data, tipo, motivo")
        .eq("funcionario_id", funcId)
        .gte("data", cicloRange!.ini)
        .lte("data", cicloRange!.fim)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: adiantamentosPrevistos = [] } = useQuery({
    queryKey: ["rh_adiantamentos_previstos", funcId, mesRef],
    enabled: !!funcId && !!mesRef,
    queryFn: async () => {
      const alvo = mesRef + "-01";
      const { data, error } = await supabase
        .from("rh_adiantamentos")
        .select("id, data, valor, datas_pagamento_pretendidas, observacoes")
        .eq("funcionario_id", funcId)
        .contains("datas_pagamento_pretendidas", [alvo]);
      if (error) throw error;
      return data || [];
    },
  });

  const totalAdiantamentosPrevistos = useMemo(
    () => (adiantamentosPrevistos as any[]).reduce((s, a) => s + Number(a.valor || 0), 0),
    [adiantamentosPrevistos]
  );

  // Benefício de moradia vigente para o funcionário no mês selecionado
  const { data: beneficioMoradia = null } = useQuery({
    queryKey: ["rh_beneficio_moradia_vigente", funcId, mesRef],
    enabled: !!funcId && !!mesRef,
    queryFn: async () => {
      const [y, m] = mesRef.split("-").map(Number);
      const ini = `${mesRef}-01`;
      const fimDate = new Date(y, m, 0); // último dia do mês
      const fim = format(fimDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("rh_funcionario_beneficios_moradia")
        .select("*")
        .eq("funcionario_id", funcId)
        .lte("data_inicio", fim)
        .or(`data_fim.is.null,data_fim.gte.${ini}`)
        .order("data_inicio", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },
  });

  const moradiaCalculada = useMemo(() => {
    if (!beneficioMoradia) return null;
    const aluguel = Number((beneficioMoradia as any).valor_reembolso_aluguel) || 0;
    const perc = Number((beneficioMoradia as any).percentual_auxilio_moradia) || 0;
    const remun = selectedFuncCargo?.remuneracao ?? 0;
    const auxilio = remun * (perc / 100);
    return { aluguel, auxilio, perc, remun };
  }, [beneficioMoradia, selectedFuncCargo]);

  // Sugere preencher o desconto quando há adiantamentos previstos e o campo está vazio
  useEffect(() => {
    if (!editingId && totalAdiantamentosPrevistos > 0 && (!descontos || parseFloat(descontos) === 0)) {
      setDescontos(totalAdiantamentosPrevistos.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAdiantamentosPrevistos, editingId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let anexo_holerite_path: string | null = null;
      if (file) {
        const path = `folha/${funcId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_holerite_path = path;
      }
      const payload: any = {
        funcionario_id: funcId,
        mes_referencia: mesRef + "-01",
        horas_atraso_faltas: parseFloat(horasAtraso) || 0,
        horas_extra: parseFloat(horasExtra) || 0,
        plano_saude: parseFloat(planoSaude) || 0,
        desconto_titulo_parque: parseFloat(descontoParque) || 0,
        auxilio_educacional: auxilioEdu,
        descontos_adiantamentos: parseFloat(descontos) || 0,
        valor_comissoes: parseFloat(comissoes) || 0,
        valor_plr: parseFloat(plr) || 0,
        observacoes: obs || null,
        valor_vr: parseFloat(valorVr) || 0,
        vr_desconsiderado: vrDesconsiderado,
        vr_justificativa: vrDesconsiderado ? (vrJustificativa || null) : null,
      };
      if (file) payload.anexo_holerite_path = anexo_holerite_path;

      let folhaId = editingId;
      if (editingId) {
        const { error } = await supabase.from("rh_folha_mensal").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.anexo_holerite_path = anexo_holerite_path;
        const { data, error } = await supabase.from("rh_folha_mensal").insert(payload).select("id").single();
        if (error) throw error;
        folhaId = data.id;
      }

      // Sincroniza lista de descontos
      if (folhaId) {
        await supabase.from("rh_folha_descontos").delete().eq("folha_id", folhaId);
        if (descontosLista.length > 0) {
          const rows = descontosLista.map((d) => ({
            folha_id: folhaId,
            tipo: d.tipo,
            valor: parseFloat(d.valor) || 0,
            observacao: d.observacao || null,
          }));
          const { error } = await supabase.from("rh_folha_descontos").insert(rows);
          if (error) throw error;
        }

        // Sincroniza lista de reembolsos (manual + automático do benefício de moradia)
        await supabase.from("rh_folha_reembolsos").delete().eq("folha_id", folhaId);
        const reembRows: any[] = reembolsosLista.map((d) => ({
          folha_id: folhaId,
          tipo: d.tipo,
          valor: parseFloat(d.valor) || 0,
          observacao: d.observacao || null,
          origem: "manual",
        }));
        if (moradiaCalculada) {
          if (moradiaCalculada.aluguel > 0) {
            reembRows.push({
              folha_id: folhaId,
              tipo: "Reembolso de Aluguel",
              valor: moradiaCalculada.aluguel,
              observacao: "Aplicado automaticamente do benefício de moradia",
              origem: "beneficio_moradia",
            });
          }
          if (moradiaCalculada.auxilio > 0) {
            reembRows.push({
              folha_id: folhaId,
              tipo: "Auxílio Moradia",
              valor: moradiaCalculada.auxilio,
              observacao: `${moradiaCalculada.perc}% sobre salário de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(moradiaCalculada.remun)}`,
              origem: "beneficio_moradia",
            });
          }
        }
        if (reembRows.length > 0) {
          const { error } = await supabase.from("rh_folha_reembolsos").insert(reembRows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_folha_mensal"] });
      queryClient.invalidateQueries({ queryKey: ["rh_folha_descontos_meses"] });
      queryClient.invalidateQueries({ queryKey: ["rh_folha_descontos_detalhes"] });
      queryClient.invalidateQueries({ queryKey: ["rh_folha_reembolsos_meses"] });
      queryClient.invalidateQueries({ queryKey: ["rh_folha_reembolsos_detalhes"] });
      toast.success(editingId ? "Folha atualizada." : "Folha registrada.");
      closeDialog();
    },
    onError: (e: any) => toast.error("Erro ao salvar folha: " + (e?.message || "")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_holerite_path: string | null }) => {
      if (r.anexo_holerite_path) await supabase.storage.from("rh-anexos").remove([r.anexo_holerite_path]);
      const { error } = await supabase.from("rh_folha_mensal").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_folha_mensal"] }); toast.success("Folha excluída."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null); setDialogEmpresaId(""); setFuncId(""); setMesRef(""); setHorasAtraso(""); setHorasExtra("");
    setPlanoSaude(""); setDescontoParque(""); setAuxilioEdu(false);
    setDescontos(""); setComissoes(""); setPlr(""); setObs(""); setFile(null);
    setVrDesconsiderado(false); setVrJustificativa(""); setValorVr("");
    setDescontosLista([]); setNovoDescontoTipo(""); setNovoDescontoValor(""); setNovoDescontoObs("");
    setReembolsosLista([]); setNovoReembolsoTipo(""); setNovoReembolsoValor(""); setNovoReembolsoObs("");
    setDialogOpen(true);
  };

  const openEdit = async (f: any) => {
    setEditingId(f.id); setFuncId(f.funcionario_id); setMesRef(f.mes_referencia?.slice(0, 7) || "");
    const empAt = getEmpresaAtDate(f.funcionario_id, f.mes_referencia);
    setDialogEmpresaId(empAt || "");
    setHorasAtraso(String(f.horas_atraso_faltas)); setHorasExtra(String(f.horas_extra));
    setPlanoSaude(String(f.plano_saude || 0)); setDescontoParque(String(f.desconto_titulo_parque || 0));
    setAuxilioEdu(f.auxilio_educacional); setDescontos(String(f.descontos_adiantamentos));
    setComissoes(String(f.valor_comissoes)); setPlr(String(f.valor_plr));
    setObs(f.observacoes || ""); setFile(null);
    setVrDesconsiderado(!!f.vr_desconsiderado); setVrJustificativa(f.vr_justificativa || "");
    setValorVr(String(f.valor_vr || 0));
    setNovoDescontoTipo(""); setNovoDescontoValor(""); setNovoDescontoObs("");
    setNovoReembolsoTipo(""); setNovoReembolsoValor(""); setNovoReembolsoObs("");
    const { data } = await supabase
      .from("rh_folha_descontos")
      .select("id, tipo, valor, observacao")
      .eq("folha_id", f.id);
    setDescontosLista((data || []).map((d: any) => ({
      id: d.id, tipo: d.tipo, valor: String(d.valor), observacao: d.observacao || "",
    })));
    const { data: reembData } = await supabase
      .from("rh_folha_reembolsos")
      .select("id, tipo, valor, observacao, origem")
      .eq("folha_id", f.id)
      .eq("origem", "manual");
    setReembolsosLista((reembData || []).map((d: any) => ({
      id: d.id, tipo: d.tipo, valor: String(d.valor), observacao: d.observacao || "",
    })));
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };
  const filtered = useMemo(() => {
    return (folhas as any[]).filter((f) => {
      if (filterFunc && f.funcionario_id !== filterFunc) return false;
      if (filterEmpresa) {
        const empAt = getEmpresaAtDate(f.funcionario_id, f.mes_referencia);
        if (empAt !== filterEmpresa) return false;
      }
      const data = (f.mes_referencia || "").slice(0, 10);
      const ini = filterDataIni ? format(filterDataIni, "yyyy-MM-dd") : "";
      const fim = filterDataFim ? format(filterDataFim, "yyyy-MM-dd") : "";
      if (ini && data < ini) return false;
      if (fim && data > fim) return false;
      return true;
    });
  }, [folhas, filterFunc, filterEmpresa, filterDataIni, filterDataFim, funcionariosAll, aditivosByFunc]);
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const canEditFolha = (f: any) => {
    if (role !== "usuario") return true;
    const created = new Date(f.created_at).getTime();
    return Date.now() - created <= 30 * 24 * 60 * 60 * 1000;
  };

  const exportCSV = () => {
    if (!filtered.length) { toast.error("Nenhum registro para exportar."); return; }
    const headers = [
      "Mês","Funcionário","Empresa","Cargo","Nível","Salário Base",
      "Horas Atraso/Faltas","Horas Extra","Plano Saúde","Desc. Título Parque",
      "Auxílio Educacional","Descontos/Adiantamentos","Comissões","PLR","Observações","Criado em",
    ];
    const rows = filtered.map((f: any) => {
      const func = funcionariosAll.find((x: any) => x.id === f.funcionario_id) as any;
      const cargo = func?.cargo_id ? cargoMap[func.cargo_id] : null;
      return [
        f.mes_referencia?.slice(0, 7) || "",
        f.rh_funcionarios?.nome_completo || "",
        getEmpresaNome(f.funcionario_id, f.mes_referencia),
        cargo?.nome || "",
        cargo?.nivel ?? "",
        cargo ? cargo.remuneracao.toFixed(2).replace(".", ",") : "",
        Number(f.horas_atraso_faltas || 0).toFixed(1).replace(".", ","),
        Number(f.horas_extra || 0).toFixed(1).replace(".", ","),
        Number(f.plano_saude || 0).toFixed(2).replace(".", ","),
        Number(f.desconto_titulo_parque || 0).toFixed(2).replace(".", ","),
        f.auxilio_educacional ? "Sim" : "Não",
        Number(f.descontos_adiantamentos || 0).toFixed(2).replace(".", ","),
        Number(f.valor_comissoes || 0).toFixed(2).replace(".", ","),
        Number(f.valor_plr || 0).toFixed(2).replace(".", ","),
        (f.observacoes || "").replace(/\r?\n/g, " "),
        f.created_at ? new Date(f.created_at).toLocaleString("pt-BR") : "",
      ];
    });
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `folha_mensal_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Folha</Button>
        <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Exportar relatório</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Combobox
          options={empresas.map((e: any) => ({ value: e.id, label: e.nome }))}
          value={filterEmpresa}
          onValueChange={setFilterEmpresa}
          placeholder="Filtrar por empresa"
        />
        <Combobox
          options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))}
          value={filterFunc}
          onValueChange={setFilterFunc}
          placeholder="Filtrar por funcionário"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDataIni && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDataIni ? format(filterDataIni, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterDataIni} onSelect={setFilterDataIni} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal", !filterDataFim && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDataFim ? format(filterDataFim, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterDataFim} onSelect={setFilterDataFim} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      </div>
      {(filterEmpresa || filterFunc || filterDataIni || filterDataFim) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setFilterEmpresa(""); setFilterFunc(""); setFilterDataIni(undefined); setFilterDataFim(undefined); }}>
            Limpar filtros
          </Button>
        </div>
      )}

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Mês</TableHead><TableHead>Funcionário</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>H. Atraso</TableHead><TableHead>H. Extra</TableHead>
            <TableHead>Pl. Saúde</TableHead><TableHead>Título Parque</TableHead>
            <TableHead>Comissões</TableHead><TableHead>PLR</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            : filtered.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell>{f.mes_referencia?.slice(0, 7)}</TableCell>
                <TableCell className="font-medium">{f.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{getEmpresaNome(f.funcionario_id, f.mes_referencia)}</TableCell>
                <TableCell>{Number(f.horas_atraso_faltas).toFixed(1)}h</TableCell>
                <TableCell>{Number(f.horas_extra).toFixed(1)}h</TableCell>
                <TableCell className="tabular-nums">{fmt(Number(f.plano_saude))}</TableCell>
                <TableCell className="tabular-nums">{fmt(Number(f.desconto_titulo_parque))}</TableCell>
                <TableCell className="tabular-nums">{fmt(Number(f.valor_comissoes))}</TableCell>
                <TableCell className="tabular-nums">{fmt(Number(f.valor_plr))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)} disabled={!canEditFolha(f)} title={!canEditFolha(f) ? "Edição liberada apenas até 30 dias após o lançamento" : undefined}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(f)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Folha" : "Nova Folha"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa *</label>
              <Combobox
                options={(empresas as any[]).map((e) => ({ value: e.id, label: e.nome }))}
                value={dialogEmpresaId}
                onValueChange={(v) => { setDialogEmpresaId(v); setFuncId(""); }}
                placeholder="Selecione a empresa"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
                <Combobox
                  options={funcionarios
                    .filter((f: any) => {
                      if (!dialogEmpresaId) return false;
                      const today = new Date().toISOString().slice(0, 10);
                      return getEmpresaAtDate(f.id, today) === dialogEmpresaId;
                    })
                    .map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                  value={funcId}
                  onValueChange={setFuncId}
                  placeholder={dialogEmpresaId ? "Selecione" : "Selecione a empresa primeiro"}
                  disabled={!dialogEmpresaId}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mês de Referência *</label>
                <div className="grid grid-cols-2 gap-2">
                  <Combobox options={MESES_PT} value={mesPart} onValueChange={setMesPart} placeholder="Mês" />
                  <Combobox options={ANOS_OPTS} value={anoPart} onValueChange={setAnoPart} placeholder="Ano" />
                </div>
              </div>
            </div>
            {funcId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-md bg-muted px-3 py-2 text-sm min-w-0 break-words">
                    <span className="font-medium text-muted-foreground">Empresa:</span>{" "}
                    <span>{dialogEmpresa}</span>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2 text-sm min-w-0 break-words">
                    <span className="font-medium text-muted-foreground">Salário ({selectedFuncCargo?.nome || "—"}{selectedFuncCargo?.nivel != null ? ` - Nível ${selectedFuncCargo.nivel}` : ""}):</span>{" "}
                    <span className="tabular-nums">{selectedFuncCargo ? fmt(selectedFuncCargo.remuneracao) : "—"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-md bg-muted px-3 py-2 text-sm min-w-0 break-words">
                    <span className="font-medium text-muted-foreground">Tipo de Contrato:</span>{" "}
                    <span>{selectedFuncTipoContrato || "—"}</span>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-sm font-medium">Vale Refeição (VR) (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorVr}
                      onChange={(e) => setValorVr(e.target.value)}
                      disabled={vrDesconsiderado}
                    />
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="vr-desc"
                      checked={vrDesconsiderado}
                      onChange={(e) => setVrDesconsiderado(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="vr-desc" className="text-sm font-medium cursor-pointer">
                      Desconsiderar VR nesta folha
                    </label>
                  </div>
                  {vrDesconsiderado && (
                    <Textarea
                      placeholder="Justificativa para desconsiderar o VR"
                      value={vrJustificativa}
                      onChange={(e) => setVrJustificativa(e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              </>
            )}
            {funcId && cicloRange && advertenciasCiclo.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  ⚠ {advertenciasCiclo.length} advertência(s) no ciclo ({format(new Date(cicloRange.ini + "T00:00:00"), "dd/MM/yyyy")} a {format(new Date(cicloRange.fim + "T00:00:00"), "dd/MM/yyyy")})
                </p>
                <ul className="text-xs space-y-0.5">
                  {advertenciasCiclo.map((a: any) => (
                    <li key={a.id}>
                      <span className="font-medium">{a.tipo}</span> em {format(new Date(a.data + "T00:00:00"), "dd/MM/yyyy")} — {a.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {funcId && mesRef && adiantamentosPrevistos.length > 0 && (
              <div className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 space-y-1">
                <p className="text-sm font-semibold text-primary">
                  💰 {adiantamentosPrevistos.length} adiantamento(s) previsto(s) para este mês — Total: {fmt(totalAdiantamentosPrevistos)}
                </p>
                <ul className="text-xs space-y-0.5">
                  {(adiantamentosPrevistos as any[]).map((a) => (
                    <li key={a.id}>
                      Em {format(new Date(a.data + "T00:00:00"), "dd/MM/yyyy")} — {fmt(Number(a.valor))}
                      {a.observacoes ? ` — ${a.observacoes}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Horas Extra</label><Input type="number" step="0.1" value={horasExtra} onChange={(e) => setHorasExtra(e.target.value)} /></div>
              <div className="flex items-center gap-2 self-end pb-2"><Switch checked={auxilioEdu} onCheckedChange={setAuxilioEdu} /><label className="text-sm">Auxílio Educacional</label></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Adiantamentos (R$)</label><Input type="number" step="0.01" value={descontos} onChange={(e) => setDescontos(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Comissões (R$)</label><Input type="number" step="0.01" value={comissoes} onChange={(e) => setComissoes(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">PLR (R$)</label><Input type="number" step="0.01" value={plr} onChange={(e) => setPlr(e.target.value)} /></div>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <label className="text-sm font-medium">Descontos</label>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Combobox
                    options={TIPOS_DESCONTO.map((t) => ({ value: t, label: t }))}
                    value={novoDescontoTipo}
                    onValueChange={setNovoDescontoTipo}
                    placeholder="Tipo de desconto"
                  />
                </div>
                <div className="col-span-3">
                  <Input type="number" step="0.01" placeholder="Valor (R$)" value={novoDescontoValor} onChange={(e) => setNovoDescontoValor(e.target.value)} />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Observação" value={novoDescontoObs} onChange={(e) => setNovoDescontoObs(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Button type="button" variant="outline" className="w-full" onClick={addDescontoItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
              {descontosLista.length > 0 && (
                <div className="space-y-1 pt-2">
                  {descontosLista.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-sm rounded bg-muted px-2 py-1">
                      <div className="flex-1 truncate">
                        <span className="font-medium">{d.tipo}</span> — <span className="tabular-nums">{fmt(parseFloat(d.valor) || 0)}</span>
                        {d.observacao ? <span className="text-muted-foreground"> · {d.observacao}</span> : null}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDescontoItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    Total: {fmt(descontosLista.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0))}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Reembolsos</label>
                {moradiaCalculada && (moradiaCalculada.aluguel > 0 || moradiaCalculada.auxilio > 0) && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                    Benefício de moradia aplicado automaticamente
                  </span>
                )}
              </div>
              {moradiaCalculada && (moradiaCalculada.aluguel > 0 || moradiaCalculada.auxilio > 0) && (
                <div className="space-y-1">
                  {moradiaCalculada.aluguel > 0 && (
                    <div className="flex items-center justify-between gap-2 text-sm rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 px-2 py-1">
                      <div className="flex-1 truncate">
                        <span className="font-medium">Reembolso de Aluguel</span> — <span className="tabular-nums">{fmt(moradiaCalculada.aluguel)}</span>
                        <span className="text-muted-foreground"> · automático (cadastro do funcionário)</span>
                      </div>
                    </div>
                  )}
                  {moradiaCalculada.auxilio > 0 && (
                    <div className="flex items-center justify-between gap-2 text-sm rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 px-2 py-1">
                      <div className="flex-1 truncate">
                        <span className="font-medium">Auxílio Moradia</span> — <span className="tabular-nums">{fmt(moradiaCalculada.auxilio)}</span>
                        <span className="text-muted-foreground"> · {moradiaCalculada.perc}% do salário</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Combobox
                    options={TIPOS_REEMBOLSO.map((t) => ({ value: t, label: t }))}
                    value={novoReembolsoTipo}
                    onValueChange={setNovoReembolsoTipo}
                    placeholder="Tipo de reembolso"
                  />
                </div>
                <div className="col-span-3">
                  <Input type="number" step="0.01" placeholder="Valor (R$)" value={novoReembolsoValor} onChange={(e) => setNovoReembolsoValor(e.target.value)} />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Observação" value={novoReembolsoObs} onChange={(e) => setNovoReembolsoObs(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Button type="button" variant="outline" className="w-full" onClick={addReembolsoItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
              {reembolsosLista.length > 0 && (
                <div className="space-y-1 pt-2">
                  {reembolsosLista.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-sm rounded bg-muted px-2 py-1">
                      <div className="flex-1 truncate">
                        <span className="font-medium">{d.tipo}</span> — <span className="tabular-nums">{fmt(parseFloat(d.valor) || 0)}</span>
                        {d.observacao ? <span className="text-muted-foreground"> · {d.observacao}</span> : null}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeReembolsoItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    Total manual: {fmt(reembolsosLista.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0))}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Holerite (anexo)</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-3 w-3" /> Selecionar</Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !mesRef || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
