import { useState, useMemo } from "react";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Cake, Building2, FileDown } from "lucide-react";
import * as XLSX from "xlsx";

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length <= 1) return (parts[0]?.[0] || "?").toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseMonthDay(dateStr: string): { month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length < 3) return null;
  return { month: parseInt(parts[1], 10), day: parseInt(parts[2], 10) };
}

function daysUntilDate(target: Date, today: Date): number {
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatDate(month: number, day: number): string {
  return `${day} de ${MONTHS_SHORT[month - 1]}`;
}

function formatMilestone(months: number): string {
  if (months < 12) return `${months} meses`;
  const years = months / 12;
  return years === 1 ? "1 ano" : `${years} anos`;
}

interface AnniversaryItem {
  id: string;
  nome: string;
  cargo: string | null;
  equipe: string | null;
  month: number;
  day: number;
  daysUntil: number;
  milestone?: string;
  fullDate?: string;
  idade?: number;
}

function AnniversaryList({ items, emptyMessage }: { items: AnniversaryItem[]; emptyMessage: string }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item, idx) => (
        <Card key={`${item.id}-${idx}`} className={item.daysUntil === 0 ? "border-primary bg-primary/5" : ""}>
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                {getInitials(item.nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{item.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[item.cargo, item.equipe].filter(Boolean).join(" — ") || "—"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium">
                {item.fullDate || formatDate(item.month, item.day)}
                {item.idade !== undefined && (
                  <span className="text-xs text-muted-foreground ml-1">({item.idade} anos)</span>
                )}
              </p>
              <div className="flex items-center gap-1 justify-end flex-wrap">
                {item.milestone && (
                  <Badge variant="outline" className="text-xs">{item.milestone}</Badge>
                )}
                <Badge
                  variant={item.daysUntil === 0 ? "default" : item.daysUntil < 0 ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {item.daysUntil === 0
                    ? "Hoje!"
                    : item.daysUntil === 1
                      ? "Amanhã"
                      : item.daysUntil < 0
                        ? `há ${Math.abs(item.daysUntil)} dias`
                        : `em ${item.daysUntil} dias`}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Aniversarios() {
  const { funcionarios, isActive, admissaoMap, isLoading } = useActiveEmployees();
  const [tab, setTab] = useState<"pessoal" | "empresa">("pessoal");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const currentYear = today.getFullYear();
  const [ano, setAno] = useState<number>(currentYear);

  const anoOptions = useMemo(() => {
    const arr: { value: string; label: string }[] = [];
    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
      arr.push({ value: String(y), label: String(y) });
    }
    return arr;
  }, [currentYear]);

  // Birthdays for the whole selected year (Jan–Dec)
  const birthdays = useMemo(() => {
    const items: AnniversaryItem[] = [];
    for (const f of funcionarios as any[]) {
      if (!isActive(f.id)) continue;
      const md = parseMonthDay(f.aniversario);
      if (!md) continue;
      const birthday = new Date(ano, md.month - 1, md.day);
      birthday.setHours(0, 0, 0, 0);
      const days = daysUntilDate(birthday, today);
      let idade: number | undefined;
      const birthYearStr = f.aniversario?.split("-")[0];
      const birthYear = birthYearStr ? parseInt(birthYearStr, 10) : NaN;
      if (!isNaN(birthYear)) idade = ano - birthYear;
      items.push({
        id: f.id,
        nome: f.nome_completo,
        cargo: f.rh_cargos?.nome || null,
        equipe: f.rh_equipes?.nome || null,
        month: md.month,
        day: md.day,
        daysUntil: days,
        idade,
      });
    }
    items.sort((a, b) => a.month - b.month || a.day - b.day);
    return items;
  }, [funcionarios, isActive, today, ano]);

  const birthdaysByMonth = useMemo(() => {
    const m: Record<number, AnniversaryItem[]> = {};
    for (const b of birthdays) (m[b.month] ||= []).push(b);
    return m;
  }, [birthdays]);

  const exportarAniversariantes = () => {
    const rows = birthdays.map((b) => ({
      "Mês": MONTHS_FULL[b.month - 1],
      "Dia": b.day,
      "Data": formatDate(b.month, b.day),
      "Funcionário": b.nome,
      "Idade": b.idade ?? "—",
      "Cargo": b.cargo || "—",
      "Equipe": b.equipe || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Aniversariantes ${ano}`);
    XLSX.writeFile(wb, `aniversariantes_${ano}.xlsx`);
  };

  // Company anniversaries (next 6 months) — mantém comportamento original
  // Company anniversaries — todos os marcos (3m, 6m, e anuais) que caem no ano selecionado
  const companyAnniversaries = useMemo(() => {
    const items: AnniversaryItem[] = [];

    for (const f of funcionarios as any[]) {
      if (!isActive(f.id)) continue;
      const admDate = f.data_contrato_vigente || admissaoMap[f.id];
      if (!admDate) continue;

      const [yearStr, monthStr, dayStr] = admDate.split("-");
      const admYear = parseInt(yearStr, 10);
      const admMonth = parseInt(monthStr, 10) - 1;
      const admDay = parseInt(dayStr, 10);

      const milestoneMonths = [3, 6];
      for (let y = 1; y <= 50; y++) milestoneMonths.push(y * 12);

      for (const m of milestoneMonths) {
        const milestoneDate = new Date(admYear, admMonth + m, admDay);
        milestoneDate.setHours(0, 0, 0, 0);
        if (milestoneDate.getFullYear() !== ano) continue;

        const diffDays = daysUntilDate(milestoneDate, today);

        items.push({
          id: f.id,
          nome: f.nome_completo,
          cargo: f.rh_cargos?.nome || null,
          equipe: f.rh_equipes?.nome || null,
          month: milestoneDate.getMonth() + 1,
          day: milestoneDate.getDate(),
          daysUntil: diffDays,
          milestone: formatMilestone(m),
          fullDate: formatDate(milestoneDate.getMonth() + 1, milestoneDate.getDate()),
        });
      }
    }

    items.sort((a, b) => a.month - b.month || a.day - b.day);
    return items;
  }, [funcionarios, isActive, admissaoMap, today, ano]);

  const companyByMonth = useMemo(() => {
    const m: Record<number, AnniversaryItem[]> = {};
    for (const b of companyAnniversaries) (m[b.month] ||= []).push(b);
    return m;
  }, [companyAnniversaries]);

  const exportarAniversariosEmpresa = () => {
    const rows = companyAnniversaries.map((b) => ({
      "Mês": MONTHS_FULL[b.month - 1],
      "Dia": b.day,
      "Data": formatDate(b.month, b.day),
      "Funcionário": b.nome,
      "Marco": b.milestone || "—",
      "Cargo": b.cargo || "—",
      "Equipe": b.equipe || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Aniversários Empresa ${ano}`);
    XLSX.writeFile(wb, `aniversarios_empresa_${ano}.xlsx`);
  };


  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pessoal">
            <Cake className="h-4 w-4 mr-1.5" /> Aniversários
          </TabsTrigger>
          <TabsTrigger value="empresa">
            <Building2 className="h-4 w-4 mr-1.5" /> Aniversários de Empresa
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "pessoal" && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Cake className="h-4 w-4" />
              <span>Janeiro a Dezembro de {ano} — {birthdays.length} aniversariante{birthdays.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32">
                <Combobox
                  options={anoOptions}
                  value={String(ano)}
                  onValueChange={(v) => setAno(parseInt(v, 10))}
                  placeholder="Ano"
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportarAniversariantes} disabled={birthdays.length === 0}>
                <FileDown className="h-4 w-4 mr-1.5" /> Gerar relatório
              </Button>
            </div>
          </div>
          {birthdays.length === 0 ? (
            <AnniversaryList items={[]} emptyMessage={`Nenhum aniversariante em ${ano}.`} />
          ) : (
            <div className="space-y-4">
              {MONTHS_FULL.map((mName, i) => {
                const monthItems = birthdaysByMonth[i + 1] || [];
                if (monthItems.length === 0) return null;
                return (
                  <div key={mName} className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {mName} <span className="text-xs font-normal">({monthItems.length})</span>
                    </h3>
                    <AnniversaryList items={monthItems} emptyMessage="" />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "empresa" && (
        <>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Building2 className="h-4 w-4" />
            <span>Próximos 6 meses — {companyAnniversaries.length} marco{companyAnniversaries.length !== 1 ? "s" : ""}</span>
          </div>
          <AnniversaryList items={companyAnniversaries} emptyMessage="Nenhum aniversário de empresa nos próximos 6 meses." />
        </>
      )}
    </div>
  );
}
