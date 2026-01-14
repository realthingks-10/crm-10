import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarkBouncedRequest {
  emailId: string;
  bounceType?: 'hard' | 'soft';
  bounceReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailId, bounceType = 'hard', bounceReason }: MarkBouncedRequest = await req.json();

    if (!emailId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: emailId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Marking email ${emailId} as bounced (${bounceType})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch email record to get current state and contact info
    const { data: emailData, error: fetchError } = await supabase
      .from("email_history")
      .select("contact_id, lead_id, account_id, status, open_count")
      .eq("id", emailId)
      .single();

    if (fetchError) {
      console.error("Error fetching email record:", fetchError);
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const wasMarkedAsOpened = emailData.status === 'opened' && (emailData.open_count || 0) > 0;

    // Update email history to bounced status
    const { error: updateError } = await supabase
      .from("email_history")
      .update({
        status: "bounced",
        bounce_type: bounceType,
        bounce_reason: bounceReason || 'Email delivery failed',
        bounced_at: new Date().toISOString(),
        open_count: 0, // Reset open count - bounced emails can't be opened
        unique_opens: 0,
        is_valid_open: false,
        opened_at: null, // Clear opened timestamp
      })
      .eq("id", emailId);

    if (updateError) {
      console.error("Error updating email history:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If the email was falsely marked as opened, decrement the contact's email_opens
    if (wasMarkedAsOpened && emailData.contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("email_opens, engagement_score")
        .eq("id", emailData.contact_id)
        .single();

      if (contact && (contact.email_opens || 0) > 0) {
        const newOpens = Math.max((contact.email_opens || 0) - 1, 0);
        const newScore = Math.max((contact.engagement_score || 0) - 5, 0);
        
        await supabase
          .from("contacts")
          .update({
            email_opens: newOpens,
            engagement_score: newScore,
          })
          .eq("id", emailData.contact_id);
        
        console.log(`Corrected contact ${emailData.contact_id} - opens: ${newOpens}, score: ${newScore}`);
      }
    }

    console.log(`Email ${emailId} marked as bounced successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email marked as bounced",
        correctedFalseOpen: wasMarkedAsOpened
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in mark-email-bounced function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to mark email as bounced" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
