// Public endpoint that returns the current organogram as a PNG image.
// Generates SVG server-side (no <foreignObject>) and rasterizes via @resvg/resvg-wasm.
// Designed for Google Apps Script (UrlFetchApp.fetch).

import { createClient } from "npm:@supabase/supabase-js@2";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// ---------- Layout constants ----------
const NODE_W = 240;
const NODE_H = 84;
const H_GAP = 24;
const V_GAP = 60;
const PADDING = 16;        // tight outer padding (was 40)
const TITLE_H = 28;        // compact header band (was 60)
const FONT = "Noto Sans, Helvetica, Arial, sans-serif";

interface LaidOutNode {
  id: string;
  nome: string;
  cargo: string | null;
  equipe: string | null;
  gestor_id: string | null;
  children: LaidOutNode[];
  x: number;
  y: number;
  width: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1).trimEnd() + "…";
}

function measure(node: LaidOutNode): number {
  if (node.children.length === 0) {
    node.width = NODE_W;
    return node.width;
  }
  let total = 0;
  for (let i = 0; i < node.children.length; i++) {
    total += measure(node.children[i]);
    if (i < node.children.length - 1) total += H_GAP;
  }
  node.width = Math.max(NODE_W, total);
  return node.width;
}

function position(node: LaidOutNode, left: number, depth: number) {
  const y = PADDING + TITLE_H + depth * (NODE_H + V_GAP);
  node.y = y;
  node.x = left + (node.width - NODE_W) / 2;
  if (node.children.length === 0) return;

  let childrenWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    childrenWidth += node.children[i].width;
    if (i < node.children.length - 1) childrenWidth += H_GAP;
  }
  let cursor = left + (node.width - childrenWidth) / 2;
  for (const child of node.children) {
    position(child, cursor, depth + 1);
    cursor += child.width + H_GAP;
  }
}

function renderCard(n: LaidOutNode): string {
  const nome = escapeXml(truncate(n.nome, 30));
  const cargo = n.cargo ? escapeXml(truncate(n.cargo, 32)) : "";
  const equipe = n.equipe ? escapeXml(truncate(n.equipe, 32)) : "";
  const cx = n.x + NODE_W / 2;
  return `
    <g>
      <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="8" ry="8"
            fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
      <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="4" rx="2" ry="2" fill="#1e40af"/>
      <text x="${cx}" y="${n.y + 28}" text-anchor="middle"
            font-family="${FONT}" font-size="13" font-weight="700" fill="#0f172a">${nome}</text>
      <text x="${cx}" y="${n.y + 48}" text-anchor="middle"
            font-family="${FONT}" font-size="11" fill="#475569">${cargo}</text>
      <text x="${cx}" y="${n.y + 66}" text-anchor="middle"
            font-family="${FONT}" font-size="10" fill="#64748b" font-style="italic">${equipe}</text>
    </g>`;
}

function renderConnectors(n: LaidOutNode): string {
  if (n.children.length === 0) return "";
  const parentBottomX = n.x + NODE_W / 2;
  const parentBottomY = n.y + NODE_H;
  const trunkY = parentBottomY + V_GAP / 2;
  const segments: string[] = [];
  segments.push(
    `<line x1="${parentBottomX}" y1="${parentBottomY}" x2="${parentBottomX}" y2="${trunkY}" stroke="#94a3b8" stroke-width="1.2"/>`,
  );
  const xs = n.children.map((c) => c.x + NODE_W / 2);
  const minX = Math.min(...xs, parentBottomX);
  const maxX = Math.max(...xs, parentBottomX);
  segments.push(
    `<line x1="${minX}" y1="${trunkY}" x2="${maxX}" y2="${trunkY}" stroke="#94a3b8" stroke-width="1.2"/>`,
  );
  for (const child of n.children) {
    const cx = child.x + NODE_W / 2;
    segments.push(
      `<line x1="${cx}" y1="${trunkY}" x2="${cx}" y2="${child.y}" stroke="#94a3b8" stroke-width="1.2"/>`,
    );
    segments.push(renderConnectors(child));
  }
  return segments.join("\n");
}

function collectAll(n: LaidOutNode, out: LaidOutNode[]) {
  out.push(n);
  for (const c of n.children) collectAll(c, out);
}

// ---------- WASM + Font init (cached per isolate) ----------
let wasmReady: Promise<void> | null = null;
let fontBuffers: Uint8Array[] | null = null;

const FONT_URLS = [
  // Noto Sans (Latin) — regular & bold, full pt-BR accent coverage.
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-400-normal.ttf",
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-700-normal.ttf",
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.22/files/noto-sans-latin-ext-400-normal.ttf",
];

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const [wasmRes, ...fontRes] = await Promise.all([
        fetch("https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
        ...FONT_URLS.map((u) => fetch(u)),
      ]);
      const bytes = await wasmRes.arrayBuffer();
      await initWasm(bytes);
      fontBuffers = await Promise.all(
        fontRes.map(async (r) => new Uint8Array(await r.arrayBuffer())),
      );
    })();
  }
  await wasmReady;
}

async function buildSvg(): Promise<{ svg: string; count: number }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: employees, error: empErr } = await supabase
    .from("rh_funcionarios")
    .select(
      "id, nome_completo, gestor_id, cargo_id, equipe_id, rh_cargos(nome), rh_equipes(nome)",
    )
    .order("nome_completo");
  if (empErr) throw empErr;

  const { data: events, error: evErr } = await supabase
    .from("rh_admissoes_desligamentos")
    .select("funcionario_id, tipo, data")
    .order("data", { ascending: false });
  if (evErr) throw evErr;

  const statusMap = new Map<string, string>();
  for (const e of events ?? []) {
    if (!statusMap.has(e.funcionario_id)) statusMap.set(e.funcionario_id, e.tipo);
  }
  const active = (employees ?? []).filter(
    (e: any) => statusMap.get(e.id) !== "desligamento",
  );

  const nodeMap = new Map<string, LaidOutNode>();
  for (const e of active) {
    nodeMap.set(e.id, {
      id: e.id,
      nome: e.nome_completo,
      cargo: (e.rh_cargos as any)?.nome ?? null,
      equipe: (e.rh_equipes as any)?.nome ?? null,
      gestor_id: e.gestor_id,
      children: [],
      x: 0,
      y: 0,
      width: 0,
    });
  }

  const roots: LaidOutNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.gestor_id && nodeMap.has(node.gestor_id)) {
      nodeMap.get(node.gestor_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (n: LaidOutNode) => {
    n.children.sort((a, b) => a.nome.localeCompare(b.nome));
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => a.nome.localeCompare(b.nome));
  roots.forEach(sortRec);

  if (roots.length === 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <text x="300" y="60" text-anchor="middle" font-family="${FONT}" font-size="16" fill="#475569">
        Nenhum funcionário ativo encontrado.
      </text>
    </svg>`;
    return { svg: emptySvg, count: 0 };
  }

  for (const r of roots) measure(r);
  let cursor = PADDING;
  for (const r of roots) {
    position(r, cursor, 0);
    cursor += r.width + H_GAP * 2;
  }

  const all: LaidOutNode[] = [];
  for (const r of roots) collectAll(r, all);

  const maxX = Math.max(...all.map((n) => n.x + NODE_W));
  const maxY = Math.max(...all.map((n) => n.y + NODE_H));
  const svgW = maxX + PADDING;
  const svgH = maxY + PADDING;

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const header = `
    <text x="${PADDING}" y="${PADDING + 12}" font-family="${FONT}" font-size="14" font-weight="700" fill="#0f172a">Organograma</text>
    <text x="${PADDING}" y="${PADDING + 26}" font-family="${FONT}" font-size="10" fill="#64748b">Atualizado em ${escapeXml(dateStr)} • ${all.length} funcionário(s) ativo(s)</text>
  `;

  const connectors = roots.map(renderConnectors).join("\n");
  const cards = all.map(renderCard).join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  ${header}
  ${connectors}
  ${cards}
</svg>`;

  return { svg, count: all.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await ensureWasm();
    const { svg } = await buildSvg();

    // Optional ?width=NNNN to control output resolution (defaults to SVG intrinsic width).
    const url = new URL(req.url);
    const widthParam = url.searchParams.get("width");
    const width = widthParam ? Math.max(200, Math.min(8000, parseInt(widthParam, 10) || 0)) : undefined;

    const resvg = new Resvg(svg, {
      background: "#f8fafc",
      fitTo: width ? { mode: "width", value: width } : { mode: "original" },
      font: {
        loadSystemFonts: false,
        fontBuffers: fontBuffers ?? [],
        defaultFontFamily: "Noto Sans",
        sansSerifFamily: "Noto Sans",
      },
    });
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="organograma.png"',
      },
    });
  } catch (err) {
    console.error("organograma-png error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
