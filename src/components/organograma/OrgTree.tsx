import { useState, useCallback } from "react";
import { type OrgNode } from "@/hooks/useOrganograma";
import { OrgNodeCard } from "./OrgNodeCard";
import "./org-tree.css";

interface OrgTreeProps {
  roots: OrgNode[];
  canEdit: boolean;
  onEdit: (node: OrgNode) => void;
  countDescendants: (node: OrgNode) => number;
}

export function OrgTree({ roots, canEdit, onEdit, countDescendants }: OrgTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const collapseAll = useCallback(() => {
    const ids = new Set<string>();
    const collect = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) ids.add(n.id);
        collect(n.children);
      }
    };
    collect(roots);
    setCollapsed(ids);
  }, [roots]);

  const renderNode = (node: OrgNode) => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <li key={node.id}>
        <OrgNodeCard
          node={node}
          descendantCount={countDescendants(node)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggleCollapse(node.id)}
          canEdit={canEdit}
          onEdit={onEdit}
        />
        {hasChildren && !isCollapsed && (
          <ul>{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  return { roots, renderNode, expandAll, collapseAll };
}

interface OrgTreeViewProps {
  roots: OrgNode[];
  canEdit: boolean;
  onEdit: (node: OrgNode) => void;
  countDescendants: (node: OrgNode) => number;
}

export function OrgTreeView({ roots, canEdit, onEdit, countDescendants }: OrgTreeViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderNode = (node: OrgNode) => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <li key={node.id}>
        <OrgNodeCard
          node={node}
          descendantCount={countDescendants(node)}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggleCollapse(node.id)}
          canEdit={canEdit}
          onEdit={onEdit}
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
