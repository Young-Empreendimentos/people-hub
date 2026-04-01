import { useState, useMemo } from "react";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cake, Building2 } from "lucide-react";

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

function daysUntilBirthday(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear();
  let birthday = new Date(thisYear, month - 1, day);
  if (birthday < today) {
    birthday = new Date(thisYear + 1, month - 1, day);
  }
  return Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(month: number, day: number): string {
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${day} de ${months[month - 1]}`;
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
              </p>
              <div className="flex items-center gap-1 justify-end">
                {item.milestone && (
                  <Badge variant="outline" className="text-xs">{item.milestone}</Badge>
                )}
                <Badge
                  variant={item.daysUntil === 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {item.daysUntil === 0
                    ? "Hoje!"
                    : item.daysUntil === 1
                      ? "Amanhã"
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

  // Birthday anniversaries (next 3 months)
  const birthdays = useMemo(() => {
    const items: AnniversaryItem[] = [];
    for (const f of funcionarios as any[]) {
      if (!isActive(f.id)) continue;
      const md = parseMonthDay(f.aniversario);
      if (!md) continue;
      const days = daysUntilBirthday(md.month, md.day, today);
      if (days <= 90) {
        items.push({
          id: f.id,
          nome: f.nome_completo,
          cargo: f.rh_cargos?.nome || null,
          equipe: f.rh_equipes?.nome || null,
          month: md.month,
          day: md.day,
          daysUntil: days,
        });
      }
    }
    items.sort((a, b) => a.daysUntil - b.daysUntil);
    return items;
  }, [funcionarios, isActive, today]);

  // Company anniversaries (next 6 months)
  // Milestones: 3 months, 6 months, then yearly (12, 24, 36, ...)
  const companyAnniversaries = useMemo(() => {
    const items: AnniversaryItem[] = [];
    const admMap = admissaoMap as Record<string, string>;

    for (const f of funcionarios as any[]) {
      if (!isActive(f.id)) continue;
      const admDate = admMap[f.id];
      if (!admDate) continue;

      const [yearStr, monthStr, dayStr] = admDate.split("-");
      const admYear = parseInt(yearStr, 10);
      const admMonth = parseInt(monthStr, 10) - 1; // 0-based
      const admDay = parseInt(dayStr, 10);
      const admission = new Date(admYear, admMonth, admDay);

      // Calculate milestones: 3m, 6m, 12m, 24m, 36m, ...
      const milestoneMonths = [3, 6];
      for (let y = 1; y <= 50; y++) milestoneMonths.push(y * 12);

      for (const m of milestoneMonths) {
        const milestoneDate = new Date(admYear, admMonth + m, admDay);
        if (milestoneDate <= today) continue;

        const diffMs = milestoneDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 180) {
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
          break; // Only next milestone per employee
        }
      }
    }

    items.sort((a, b) => a.daysUntil - b.daysUntil);
    return items;
  }, [funcionarios, isActive, admissaoMap, today]);

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
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Cake className="h-4 w-4" />
            <span>Próximos 3 meses — {birthdays.length} aniversário{birthdays.length !== 1 ? "s" : ""}</span>
          </div>
          <AnniversaryList items={birthdays} emptyMessage="Nenhum aniversário nos próximos 3 meses." />
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
