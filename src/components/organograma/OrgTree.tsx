import { useState, useCallback, useMemo } from "react";
import { type OrgNode } from "@/hooks/useOrganograma";
import { OrgNodeCard } from "./OrgNodeCard";
import "./org-tree.css";

interface OrgTreeViewProps {
  roots: OrgNode[];
  canEdit: boolean;
  onEdit: (node: OrgNode) => void;
  countDescendants: (node: OrgNode) => number;
  search?: string;
}

function collectMatchIds(nodes: OrgNode[], query: string): Set<string> {
  const matched = new Set<string>();
  const q = query.toLowerCase();

  const walk = (node: OrgNode): boolean => {
    const selfMatch = node.nome_completo.toLowerCase().includes(q) ||
      (node.cargo_nome && node.cargo_nome.toLowerCase().includes(q));

    let childMatch = false;
    for (const child of node.children) {
      if (walk(child)) childMatch = true;
    }

    if (selfMatch || childMatch) {
      matched.add(node.id);
      return true;
    }
    return false;
  };

  for (const root of nodes) walk(root);
  return matched;
}

export function OrgTreeView({ roots, canEdit, onEdit, countDescendants, search = "" }: OrgTreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const query = search.trim();
  const matchIds = useMemo(
    () => (query ? collectMatchIds(roots, query) : null),
    [roots, query]
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderNode = (node: OrgNode) => {
    if (matchIds && !matchIds.has(node.id)) return null;

    const isCollapsed = collapsed.has(node.id) && !query;
    const hasChildren = node.children.length > 0;
    const isHighlighted = query && node.nome_completo.toLowerCase().includes(query.toLowerCase());

    return (
      <li key={node.id}>
        <OrgNodeCard
          node={node}
          descendantCount={countDescendants(node)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggleCollapse(node.id)}
          canEdit={canEdit}
          onEdit={onEdit}
          highlighted={!!isHighlighted}
        />
        {hasChildren && !isCollapsed && (
          <ul>{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  const expandAll = () => setCollapsed(new Set());

  const collapseAll = () => {
    const ids = new Set<string>();
    const collect = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) ids.add(n.id);
        collect(n.children);
      }
    };
    collect(roots);
    setCollapsed(ids);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={expandAll}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
        >
          Expandir tudo
        </button>
        <button
          onClick={collapseAll}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border"
        >
          Colapsar tudo
        </button>
      </div>
      <div className="org-tree overflow-x-auto pb-8">
        <ul className="org-tree-root">
          {roots.map(renderNode)}
        </ul>
      </div>
    </div>
  );
}
