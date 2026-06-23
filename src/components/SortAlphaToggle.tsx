import { Button } from "@/components/ui/button";
import { ArrowDownAZ, ArrowUpZA, ArrowUpDown } from "lucide-react";

export type SortAlpha = "none" | "asc" | "desc";

export function sortByName<T>(arr: T[], getName: (item: T) => string, dir: SortAlpha): T[] {
  if (dir === "none") return arr;
  const sorted = [...arr].sort((a, b) =>
    (getName(a) || "").localeCompare(getName(b) || "", "pt-BR", { sensitivity: "base" })
  );
  return dir === "asc" ? sorted : sorted.reverse();
}

export function SortAlphaToggle({
  value,
  onChange,
  className,
}: {
  value: SortAlpha;
  onChange: (v: SortAlpha) => void;
  className?: string;
}) {
  const next: SortAlpha = value === "none" ? "asc" : value === "asc" ? "desc" : "none";
  const Icon = value === "asc" ? ArrowDownAZ : value === "desc" ? ArrowUpZA : ArrowUpDown;
  const label = value === "asc" ? "A → Z" : value === "desc" ? "Z → A" : "Ordenar A-Z";
  return (
    <Button
      variant={value === "none" ? "outline" : "default"}
      size="sm"
      onClick={() => onChange(next)}
      className={className}
      title="Ordenar por nome do funcionário"
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
