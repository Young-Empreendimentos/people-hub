import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const APP_URL = "https://id-preview--6752548d-da6b-42dc-83aa-8a694a502eb1.lovable.app";
const FROM = "Young RH <rh@youngempreendimentos.com.br>";

const DESTINATARIOS = {
  comercial: { email: "caroline@youngempreendimentos.com.br", nome: "Caroline" },
  outros: { email: "eduardo@youngempreendimentos.com.br", nome: "Eduardo" },
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function buildHtml(nome: string, setor: string, itens: any[], total: number) {
  const rows = itens
    .map(
      (l) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.funcionario}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${l.equipe}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${fmtDate(l.data)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Number(l.km).toFixed(2)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtBRL(Number(l.valor_total || 0))}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;">
    <h2>Olá, ${nome}!</h2>
    <p>Existem <b>${itens.length} lançamento(s) de KM pendente(s)</b> de aprovação no setor <b>${setor}</b>.</p>
    <p>Por favor, revise e aprove para que possam entrar na folha do mês.</p>
    <table style="border-collapse:collapse;width:100%;margin-top:12px;font-size:13px;">
      <thead><tr style="background:#f5f5f5;">
        <th style="padding:6px 10px;text-align:left;">Funcionário</th>
        <th style="padding:6px 10px;text-align:left;">Equipe</th>
        <th style="padding:6px 10px;text-align:left;">Data</th>
        <th style="padding:6px 10px;text-align:right;">KM</th>
        <th style="padding:6px 10px;text-align:right;">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="4" style="padding:8px 10px;text-align:right;font-weight:bold;">Total geral</td>
        <td style="padding:8px 10px;text-align:right;font-weight:bold;">${fmtBRL(total)}</td>
      </tr></tfoot>
    </table>
    <p style="margin-top:20px;">
      <a href="${APP_URL}/aprovacoes-km" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
        Abrir aprovações de KM
      </a>
    </p>
    <p style="color:#666;font-size:12px;margin-top:24px;">Mensagem automática — Young Empreendimentos</p>
  </body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${body}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: pendentes, error } = await supabase
      .from("rh_km_lancamentos")
      .select("id, data, km, valor_total, funcionario_id")
      .eq("status", "pendente");
    if (error) throw error;

    const funcIds = [...new Set((pendentes || []).map((l: any) => l.funcionario_id))];
    const { data: funcs } = await supabase
      .from("rh_funcionarios")
      .select("id, nome_completo, equipe_id")
      .in("id", funcIds.length ? funcIds : ["00000000-0000-0000-0000-000000000000"]);

    const equipeIds = [...new Set((funcs || []).map((f: any) => f.equipe_id).filter(Boolean))];
    const { data: equipes } = await supabase
      .from("rh_equipes")
      .select("id, nome")
      .in("id", equipeIds.length ? equipeIds : ["00000000-0000-0000-0000-000000000000"]);

    const equipeMap = new Map((equipes || []).map((e: any) => [e.id, e.nome]));
    const funcMap = new Map(
      (funcs || []).map((f: any) => [
        f.id,
        { nome: f.nome_completo, equipe: equipeMap.get(f.equipe_id) || "—" },
      ]),
    );

    const comercial: any[] = [];
    const outros: any[] = [];
    for (const l of pendentes || []) {
      const f = funcMap.get(l.funcionario_id);
      if (!f) continue;
      const item = {
        ...l,
        funcionario: f.nome,
        equipe: f.equipe,
      };
      if (f.equipe.toLowerCase().includes("comercial")) comercial.push(item);
      else outros.push(item);
    }

    const sentReports: any[] = [];

    for (const [setor, itens, dest] of [
      ["Comercial", comercial, DESTINATARIOS.comercial],
      ["Demais setores", outros, DESTINATARIOS.outros],
    ] as const) {
      if (!itens.length) {
        sentReports.push({ setor, pendentes: 0, enviado: false });
        continue;
      }
      const total = itens.reduce((s, i) => s + Number(i.valor_total || 0), 0);
      const html = buildHtml(dest.nome, setor, itens, total);
      await sendEmail(
        dest.email,
        `[Young RH] ${itens.length} aprovação(ões) de KM pendente(s) — ${setor}`,
        html,
      );
      sentReports.push({ setor, pendentes: itens.length, total, enviado: true, para: dest.email });
    }

    return new Response(JSON.stringify({ ok: true, sentReports }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
