const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Young RH <carla@youngempreendimentos.com.br>";
const TO = "suelen@youngempreendimentos.com.br";
const APP_URL = "https://pilares.youngempreendimentos.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const nome = body.nome || "—";
    const email = body.email || "—";
    const role = body.role || "—";

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;">
      <p>Olá, Suelen!</p>
      <p>Um novo usuário solicitou acesso ao <b>Pilares</b> e está aguardando aprovação:</p>
      <ul>
        <li><b>Nome:</b> ${nome}</li>
        <li><b>Email:</b> ${email}</li>
        <li><b>Perfil solicitado:</b> ${role}</li>
      </ul>
      <p>Acesse para aprovar:
        <a href="${APP_URL}/configuracoes">${APP_URL}/configuracoes</a>
      </p>
    </body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: "Novo cadastro aguardando aprovação — Pilares",
        html,
      }),
    });
    const respBody = await r.text();
    if (!r.ok) throw new Error(`Resend ${r.status}: ${respBody}`);

    return new Response(JSON.stringify({ ok: true }), {
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
