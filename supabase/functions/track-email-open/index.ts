import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

// Known bot/scanner user agents that trigger false opens
const BOT_USER_AGENTS = [
  'microsoft-exchange',
  'msexchange',
  'barracuda',
  'proofpoint',
  'mimecast',
  'fireeye',
  'googleimageproxy',
  'ymailproxy',
  'outlookproxy',
  'yahoo mail proxy',
  'appengine-google',
  'googlebot',
  'bingbot',
  'slurp',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'python-requests',
  'curl',
  'wget',
  'httpie',
  'postman',
  'insomnia',
  'apache-httpclient',
  'java/',
  'okhttp',
  'go-http-client',
  'libwww-perl',
  'ruby',
  'php/',
  'guzzle',
  'headlesschrome',
  'phantomjs',
  'selenium',
  'puppeteer',
  'playwright',
  'atp-',
  'forefront',
  'safelinks',
  'safe links',
  'protection.outlook',
  'defender',
  'safebrowsing',
  'emailsecurity',
  'mailscanner',
  'spamassassin',
  'spamhaus',
  'messagelabs',
  'websense',
  'symantec',
  'trend micro',
  'kaspersky',
  'sophos',
  'mcafee',
  'norton',
  'avast',
  'avg',
  'clam',
  'bitdefender',
  'f-secure',
  'panda',
  'comodo',
  'eset',
  'g data',
  'zonealarm',
  'webroot',
  'malwarebytes',
];

// Minimum time in seconds before a real open should occur
const MIN_OPEN_DELAY_SECONDS = 5;

// Session deduplication window in seconds (same IP within this window = 1 open)
const DEDUP_WINDOW_SECONDS = 300; // 5 minutes

function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true; // No user agent = suspicious
  
  const lowerUA = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => lowerUA.includes(bot));
}

function getClientIP(req: Request): string {
  // Try various headers for client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  return 'unknown';
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("id");

    if (!emailId) {
      console.log("No email ID provided, returning pixel only");
      return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
    }

    const userAgent = req.headers.get('user-agent');
    const clientIP = getClientIP(req);
    
    console.log(`Tracking request for email ${emailId} - UA: ${userAgent?.substring(0, 50)}... IP: ${clientIP}`);

    // Check if this is a bot/scanner
    if (isBotUserAgent(userAgent)) {
      console.log(`Bot/scanner detected for email ${emailId}, marking as invalid open`);
      
      // Still record it but mark as invalid
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from("email_history")
        .update({ is_valid_open: false })
        .eq("id", emailId);
      
      return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch email record with sender info
    const { data: emailData, error: fetchError } = await supabase
      .from("email_history")
      .select("open_count, contact_id, lead_id, account_id, sent_at, first_open_ip, opened_at, status, bounce_type, unique_opens, sent_by, recipient_email, recipient_name, subject, sender_email")
      .eq("id", emailId)
      .single();

    if (fetchError) {
      console.error("Error fetching email record:", fetchError);
      return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
    }

    // Don't track opens for bounced emails
    if (emailData?.bounce_type) {
      console.log(`Email ${emailId} is bounced, ignoring open tracking`);
      return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
    }

    // Check if email was sent too recently (likely a scanner)
    const sentAt = new Date(emailData?.sent_at || 0);
    const now = new Date();
    const secondsSinceSend = (now.getTime() - sentAt.getTime()) / 1000;

    if (secondsSinceSend < MIN_OPEN_DELAY_SECONDS) {
      console.log(`Email ${emailId} opened too quickly (${secondsSinceSend.toFixed(1)}s), likely scanner - marking as invalid`);
      
      await supabase
        .from("email_history")
        .update({ is_valid_open: false })
        .eq("id", emailId);
      
      return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
    }

    const currentOpenCount = emailData?.open_count || 0;
    const currentUniqueOpens = emailData?.unique_opens || 0;
    const isFirstOpen = currentOpenCount === 0;
    const firstOpenIP = emailData?.first_open_ip;

    // Check for duplicate opens from same IP within dedup window
    let isUniqueOpen = false;
    if (isFirstOpen) {
      isUniqueOpen = true;
    } else if (firstOpenIP !== clientIP) {
      // Different IP = unique open
      isUniqueOpen = true;
    } else {
      // Same IP - check if opened recently
      const lastOpenedAt = emailData?.opened_at ? new Date(emailData.opened_at) : null;
      if (lastOpenedAt) {
        const secondsSinceLastOpen = (now.getTime() - lastOpenedAt.getTime()) / 1000;
        if (secondsSinceLastOpen > DEDUP_WINDOW_SECONDS) {
          isUniqueOpen = true;
        }
      }
    }

    // Build update object
    const updateData: any = {
      status: "opened",
      open_count: currentOpenCount + 1,
      is_valid_open: true,
    };

    if (isFirstOpen) {
      updateData.opened_at = now.toISOString();
      updateData.first_open_ip = clientIP;
    }

    if (isUniqueOpen) {
      updateData.unique_opens = currentUniqueOpens + 1;
    }

    // Update email history
    const { error: updateError } = await supabase
      .from("email_history")
      .update(updateData)
      .eq("id", emailId);

    if (updateError) {
      console.error("Error updating email history:", updateError);
    } else {
      console.log(`Successfully tracked open for email ${emailId} - total: ${currentOpenCount + 1}, unique: ${isUniqueOpen ? currentUniqueOpens + 1 : currentUniqueOpens}`);
    }

    // Update contact engagement score and create notification on first valid unique open
    if (isFirstOpen && emailData) {
      // Create notification for email open
      if (emailData.sent_by) {
        const recipientDisplay = emailData.recipient_name || emailData.recipient_email;
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: emailData.sent_by,
            message: `${recipientDisplay} opened your email: "${emailData.subject}"`,
            notification_type: 'email_opened',
            status: 'unread',
            lead_id: emailData.lead_id,
          });
        
        if (notifError) {
          console.warn(`Failed to create open notification:`, notifError);
        } else {
          console.log(`Created email_opened notification for user ${emailData.sent_by}`);
        }
      }

      if (emailData.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("email_opens, engagement_score")
          .eq("id", emailData.contact_id)
          .single();

        if (contact) {
          const newOpens = (contact.email_opens || 0) + 1;
          const newScore = Math.min((contact.engagement_score || 0) + 5, 100);
          
          await supabase
            .from("contacts")
            .update({
              email_opens: newOpens,
              engagement_score: newScore,
            })
            .eq("id", emailData.contact_id);
          
          console.log(`Updated contact ${emailData.contact_id} - opens: ${newOpens}, score: ${newScore}`);
        }
      }

      if (emailData.lead_id) {
        console.log(`Email associated with lead ${emailData.lead_id} - opened`);
      }

      if (emailData.account_id) {
        console.log(`Email associated with account ${emailData.account_id} - opened`);
      }
    }

    return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
  } catch (error) {
    console.error("Error tracking email open:", error);
    return new Response(TRACKING_PIXEL, { headers: PIXEL_HEADERS });
  }
};

serve(handler);
