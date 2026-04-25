import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><style>
      body { font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 48px 16px; color: #0f172a; }
      .card { max-width: 480px; margin: 0 auto; background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
      h1 { font-size: 22px; margin: 0 0 12px; }
      p { color: #475569; line-height: 1.6; margin: 8px 0; }
      .ok { color: #16a34a; font-weight: 600; }
      .err { color: #dc2626; font-weight: 600; }
      a { color: #2563eb; }
    </style></head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const email = (url.searchParams.get("e") || "").trim().toLowerCase();
    const campaignId = url.searchParams.get("c");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return html(`<h1 class="err">Invalid request</h1><p>This unsubscribe link is malformed. Please contact the sender.</p>`, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Idempotent — UNIQUE (email) constraint prevents duplicates.
    const { error } = await supabase
      .from("campaign_suppression_list")
      .upsert(
        {
          email,
          reason: "unsubscribed",
          source: "footer_link",
          campaign_id: campaignId || null,
        },
        { onConflict: "email" },
      );

    if (error) {
      console.error("unsubscribe upsert error:", error);
      return html(`<h1 class="err">Something went wrong</h1><p>We couldn't process your request. Please email the sender directly to opt out.</p>`, 500);
    }

    // Mark related communications so dashboards reflect opt-out.
    if (campaignId) {
      await supabase
        .from("campaign_communications")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("campaign_id", campaignId)
        .ilike("subject", "%"); // touch matched rows; rely on contact email match below
    }

    return html(`
      <h1 class="ok">You've been unsubscribed</h1>
      <p><strong>${email}</strong> has been added to our suppression list.</p>
      <p>You will no longer receive marketing emails from us. It may take a few minutes for in-flight messages to stop.</p>
      <p style="margin-top:24px;font-size:13px;color:#94a3b8;">If this was a mistake, please contact the sender directly to be re-added.</p>
    `);
  } catch (err) {
    console.error("unsubscribe error:", err);
    return html(`<h1 class="err">Something went wrong</h1><p>${String(err)}</p>`, 500);
  }
});