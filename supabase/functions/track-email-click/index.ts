import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("id");
    const targetUrl = url.searchParams.get("url");

    // If no target URL, return 400
    if (!targetUrl) {
      console.log("No target URL provided");
      return new Response("Missing redirect URL", { status: 400 });
    }

    // Decode the target URL
    const decodedUrl = decodeURIComponent(targetUrl);
    console.log(`Click tracking for email ${emailId || 'unknown'} - redirecting to: ${decodedUrl}`);

    // If we have an email ID, track the click
    if (emailId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch current email data
        const { data: emailData, error: fetchError } = await supabase
          .from("email_history")
          .select("click_count, clicked_at, contact_id, lead_id, account_id, sent_by, recipient_email, recipient_name, subject")
          .eq("id", emailId)
          .single();

        if (fetchError) {
          console.error("Error fetching email record:", fetchError);
        } else if (emailData) {
          const currentClickCount = emailData.click_count || 0;
          const isFirstClick = currentClickCount === 0;
          const now = new Date().toISOString();

          // Update email history with click data
          const updateData: any = {
            click_count: currentClickCount + 1,
          };

          if (isFirstClick) {
            updateData.clicked_at = now;
          }

          const { error: updateError } = await supabase
            .from("email_history")
            .update(updateData)
            .eq("id", emailId);

          if (updateError) {
            console.error("Error updating click count:", updateError);
          } else {
            console.log(`Click tracked for email ${emailId} - total clicks: ${currentClickCount + 1}`);
          }

          // Update contact engagement on first click
          if (isFirstClick && emailData.contact_id) {
            const { data: contact } = await supabase
              .from("contacts")
              .select("email_clicks, engagement_score")
              .eq("id", emailData.contact_id)
              .single();

            if (contact) {
              const newClicks = (contact.email_clicks || 0) + 1;
              const newScore = Math.min((contact.engagement_score || 0) + 10, 100);

              await supabase
                .from("contacts")
                .update({
                  email_clicks: newClicks,
                  engagement_score: newScore,
                })
                .eq("id", emailData.contact_id);

              console.log(`Updated contact ${emailData.contact_id} - clicks: ${newClicks}, score: ${newScore}`);
            }
          }

          // Create notification for email click
          if (isFirstClick && emailData.sent_by) {
            const recipientDisplay = emailData.recipient_name || emailData.recipient_email;
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: emailData.sent_by,
                message: `${recipientDisplay} clicked a link in your email: "${emailData.subject}"`,
                notification_type: 'email_clicked',
                status: 'unread',
                lead_id: emailData.lead_id,
              });

            if (notifError) {
              console.warn(`Failed to create click notification:`, notifError);
            } else {
              console.log(`Created email_clicked notification for user ${emailData.sent_by}`);
            }
          }
        }
      } catch (trackError) {
        console.error("Error tracking click:", trackError);
        // Don't block the redirect if tracking fails
      }
    }

    // Redirect to the target URL
    return new Response(null, {
      status: 302,
      headers: {
        "Location": decodedUrl,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error in click tracking:", error);
    // Try to redirect anyway if we have a URL
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");
    if (targetUrl) {
      return new Response(null, {
        status: 302,
        headers: { "Location": decodeURIComponent(targetUrl) },
      });
    }
    return new Response("Error processing click", { status: 500 });
  }
};

serve(handler);
