import { type OrgNode } from "@/hooks/useOrganograma";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface OrgNodeCardProps {
  node: OrgNode;
  descendantCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  canEdit: boolean;
  onEdit: (node: OrgNode) => void;
  highlighted?: boolean;
}

export function OrgNodeCard({
  node,
  descendantCount,
  isCollapsed,
  onToggleCollapse,
  canEdit,
  onEdit,
  highlighted,
}: OrgNodeCardProps) {
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative bg-card border rounded-lg shadow-sm px-4 py-3 w-48 cursor-pointer hover:shadow-md transition-shadow group ${highlighted ? "ring-2 ring-primary border-primary" : ""}`}
        onClick={() => navigate(`/funcionarios/${node.id}`)}
      >
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onEdit(node); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        <div className="flex flex-col items-center gap-2">
          <Avatar className="h-12 w-12">
            {node.foto_url && <AvatarImage src={node.foto_url} alt={node.nome_completo} />}
            <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
              {getInitials(node.nome_completo)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center min-w-0 w-full">
            <p className="text-sm font-semibold truncate">{node.nome_completo}</p>
            {node.cargo_nome && (
              <p className="text-xs text-muted-foreground truncate">{node.cargo_nome}</p>
            )}
          </div>
        </div>
      </div>

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-full bg-muted/50 px-2 py-0.5 z-10"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {descendantCount}
        </button>
      )}
    </div>
  );
}
