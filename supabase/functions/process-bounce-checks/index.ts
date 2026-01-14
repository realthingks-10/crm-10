import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID") || Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID") || Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET") || Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Improved NDR parsing for Office 365 format
function parseNDRContent(subject: string, body: string): { recipientEmail: string | null; reason: string | null; originalSubject: string | null } {
  let recipientEmail: string | null = null;
  let reason: string | null = null;
  let originalSubject: string | null = null;

  // Extract original subject from NDR subject line
  const subjectMatch = subject.match(/Undeliverable:\s*(.+)/i) || subject.match(/Delivery Status Notification.*?:\s*(.+)/i);
  if (subjectMatch) {
    originalSubject = subjectMatch[1].trim();
  }

  // Clean body of HTML for easier parsing
  const plainBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

  // Improved email extraction patterns for Office 365 NDRs
  const emailPatterns = [
    // Office 365: "Your message to xxx@domain.com couldn't be delivered"
    /Your message to\s+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?\s+couldn['']t be delivered/i,
    // Office 365: "message to xxx@domain.com couldn't be delivered"
    /message to\s+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?\s+couldn['']t be delivered/i,
    // "couldn't deliver to xxx@domain.com"
    /couldn['']t deliver to\s+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    // Standard: "To: xxx@domain.com"
    /(?:To|Recipient|Address):\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    // "delivery to xxx@domain.com failed"
    /delivery to\s+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?\s+(?:failed|unsuccessful)/i,
    // Fallback: any email in angle brackets
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/,
    // Fallback: any email pattern
    /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/,
  ];

  for (const pattern of emailPatterns) {
    const match = plainBody.match(pattern);
    if (match) {
      recipientEmail = match[1].toLowerCase();
      break;
    }
  }

  // Extract bounce reason - Office 365 specific patterns
  const reasonPatterns = [
    // Office 365: "xxx wasn't found at domain.com"
    /([a-zA-Z0-9._%+-]+)\s+wasn['']t found at\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    // "The email address couldn't be found"
    /(The email address couldn['']t be found[^.]*)/i,
    // "mailbox unavailable"
    /(mailbox\s+(?:unavailable|not found|full|disabled)[^.]*)/i,
    // "user unknown"
    /(user\s+(?:unknown|doesn['']t exist|not found)[^.]*)/i,
    // Error codes
    /(?:Remote Server returned|Diagnostic information).*?['"]?(\d{3}\s+\d\.\d\.\d+[^'"]*?)['"]?(?:\s|$)/i,
    /(550\s+\d\.\d\.\d+[^\n]*)/i,
    // General failure
    /(address rejected[^.]*)/i,
    /(permanent failure[^.]*)/i,
    /(Unknown To address[^.]*)/i,
  ];

  for (const pattern of reasonPatterns) {
    const match = plainBody.match(pattern);
    if (match) {
      reason = match[0].trim().substring(0, 500);
      break;
    }
  }

  if (!reason && (subject.toLowerCase().includes('undeliverable') || subject.toLowerCase().includes('failure') || subject.toLowerCase().includes('delivery status'))) {
    reason = 'Email could not be delivered';
  }

  return { recipientEmail, reason, originalSubject };
}

interface BounceCheckResult {
  recipientEmail: string;
  emailHistoryId: string;
  bounced: boolean;
  reason?: string;
  error?: string;
}

async function fetchNDRsForSender(
  accessToken: string,
  senderEmail: string,
  sinceDate: string
): Promise<Array<{ subject: string; body: string; recipientEmail: string | null; reason: string | null; receivedDateTime: string }>> {
  const ndrs: Array<{ subject: string; body: string; recipientEmail: string | null; reason: string | null; receivedDateTime: string }> = [];
  
  // Try both Inbox and Junk Email folders
  const folders = ['Inbox', 'JunkEmail'];
  
  for (const folder of folders) {
    try {
      // Fetch recent messages from the folder
      const searchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/mailFolders/${folder}/messages?$filter=receivedDateTime ge ${sinceDate}&$select=id,subject,body,from,receivedDateTime&$top=100&$orderby=receivedDateTime desc`;

      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch from ${folder} for ${senderEmail}: ${response.status} - ${errorText.substring(0, 200)}`);
        
        if (response.status === 403) {
          console.error("PERMISSION ERROR: The Azure app needs 'Mail.Read' APPLICATION permission with admin consent.");
        }
        continue;
      }

      const messagesData = await response.json();
      const messages = messagesData.value || [];
      
      // Filter for NDR messages
      const ndrKeywords = ['undeliverable', 'delivery status', 'delivery failed', 'delivery failure', 'non-delivery', 'returned mail', 'mail delivery'];
      const ndrSenders = ['postmaster', 'mailer-daemon', 'microsoft outlook'];
      
      for (const msg of messages) {
        const subject = (msg.subject || '').toLowerCase();
        const fromAddress = (msg.from?.emailAddress?.address || '').toLowerCase();
        const fromName = (msg.from?.emailAddress?.name || '').toLowerCase();
        
        const isNDRSubject = ndrKeywords.some(keyword => subject.includes(keyword));
        const isNDRSender = ndrSenders.some(sender => fromAddress.includes(sender) || fromName.includes(sender));
        
        if (isNDRSubject || isNDRSender) {
          const bodyContent = msg.body?.content || '';
          const { recipientEmail, reason } = parseNDRContent(msg.subject || '', bodyContent);
          
          if (recipientEmail) {
            ndrs.push({
              subject: msg.subject || '',
              body: bodyContent,
              recipientEmail,
              reason,
              receivedDateTime: msg.receivedDateTime,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching ${folder} for ${senderEmail}:`, error);
    }
  }
  
  return ndrs;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log("Starting bounce check process...");
  console.log("=".repeat(50));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication (optional but recommended)
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.log("No valid user session, running with service role");
      } else {
        console.log(`Running bounce check for user: ${user.email}`);
      }
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log("Successfully obtained Azure access token");
    } catch (tokenError) {
      console.error("Failed to get access token:", tokenError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Azure authentication failed",
        details: tokenError instanceof Error ? tokenError.message : "Unknown error",
        hint: "Ensure AZURE_EMAIL_TENANT_ID, AZURE_EMAIL_CLIENT_ID, and AZURE_EMAIL_CLIENT_SECRET are set correctly"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: BounceCheckResult[] = [];
    let pendingBouncesFound = 0;
    let generalBouncesFound = 0;
    const processedPendingIds: string[] = [];
    const bouncedPendingIds: string[] = [];
    
    // 1. Process pending bounce checks (queued after email sends)
    const { data: pendingChecks, error: pendingError } = await supabase
      .from('pending_bounce_checks')
      .select(`
        id,
        email_history_id,
        sender_email,
        recipient_email,
        check_after,
        email_history:email_history_id (
          id,
          sent_at,
          status,
          sent_by
        )
      `)
      .eq('checked', false)
      .lte('check_after', new Date().toISOString())
      .limit(50);

    if (pendingError) {
      console.error("Error fetching pending checks:", pendingError);
    }

    // Group pending checks by sender for efficiency
    const pendingBySender = new Map<string, typeof pendingChecks>();
    if (pendingChecks && pendingChecks.length > 0) {
      console.log(`Processing ${pendingChecks.length} pending bounce checks...`);
      
      for (const check of pendingChecks) {
        const emailHistory = check.email_history as any;
        if (!emailHistory || emailHistory.status === 'bounced') {
          processedPendingIds.push(check.id);
          continue;
        }
        
        const existing = pendingBySender.get(check.sender_email) || [];
        existing.push(check);
        pendingBySender.set(check.sender_email, existing);
      }
    }

    // Process each sender's NDRs
    const sinceDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours back
    const processedSenders = new Set<string>();
    
    for (const [senderEmail, checks] of pendingBySender.entries()) {
      if (!checks || checks.length === 0) continue;
      
      console.log(`Fetching NDRs for sender: ${senderEmail} (${checks.length} pending)`);
      
      const ndrs = await fetchNDRsForSender(accessToken, senderEmail, sinceDate);
      console.log(`Found ${ndrs.length} NDRs for ${senderEmail}`);
      processedSenders.add(senderEmail);
      
      // Match NDRs to pending checks
      for (const check of checks) {
        if (!check) continue;
        const emailHistory = check.email_history as any;
        const matchingNDR = ndrs.find(ndr => 
          ndr.recipientEmail?.toLowerCase() === check.recipient_email.toLowerCase()
        );
        
        if (matchingNDR) {
          console.log(`✅ MATCH! Found bounce for ${check.recipient_email}: ${matchingNDR.reason}`);
          
          const { error } = await supabase
            .from('email_history')
            .update({
              status: 'bounced',
              bounce_type: 'hard',
              bounce_reason: matchingNDR.reason || 'Email delivery failed',
              bounced_at: matchingNDR.receivedDateTime || new Date().toISOString(),
              open_count: 0,
              unique_opens: 0,
              opened_at: null,
              is_valid_open: false,
            })
            .eq('id', check.email_history_id);

          if (!error) {
            pendingBouncesFound++;
            bouncedPendingIds.push(check.id);
            
            // Create notification for bounce - check for duplicates first
            if (emailHistory.sent_by) {
              // Check if a similar notification already exists (prevent duplicates)
              const { data: existingNotif } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', emailHistory.sent_by)
                .eq('notification_type', 'email_bounced')
                .ilike('message', `%${check.recipient_email}%`)
                .gte('created_at', new Date(Date.now() - 60000).toISOString())
                .maybeSingle();

              if (!existingNotif) {
                const { error: notifError } = await supabase
                  .from('notifications')
                  .insert({
                    user_id: emailHistory.sent_by,
                    message: `Email to ${check.recipient_email} could not be delivered - address invalid or doesn't exist`,
                    notification_type: 'email_bounced',
                    status: 'unread',
                  });
                
                if (notifError) {
                  console.warn(`Failed to create bounce notification:`, notifError);
                }
              } else {
                console.log(`Skipping duplicate bounce notification for ${check.recipient_email}`);
              }
            }
          }
          
          results.push({
            recipientEmail: check.recipient_email,
            emailHistoryId: check.email_history_id,
            bounced: true,
            reason: matchingNDR.reason || undefined,
          });
        } else {
          results.push({
            recipientEmail: check.recipient_email,
            emailHistoryId: check.email_history_id,
            bounced: false,
          });
        }
        
        processedPendingIds.push(check.id);
      }
    }

    // Update pending checks with per-check results
    if (bouncedPendingIds.length > 0) {
      await supabase
        .from('pending_bounce_checks')
        .update({ checked: true, check_result: 'bounced' })
        .in('id', bouncedPendingIds);
    }
    
    const okPendingIds = processedPendingIds.filter(id => !bouncedPendingIds.includes(id));
    if (okPendingIds.length > 0) {
      await supabase
        .from('pending_bounce_checks')
        .update({ checked: true, check_result: 'ok' })
        .in('id', okPendingIds);
    }

    // 2. Also run general sync for recent emails not in pending (catch delayed bounces)
    console.log("-".repeat(50));
    console.log("Running general bounce sync for recent emails...");
    
    const { data: recentEmails } = await supabase
      .from('email_history')
      .select('sender_email, recipient_email, id, sent_at')
      .gte('sent_at', sinceDate)
      .not('status', 'eq', 'bounced')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (recentEmails && recentEmails.length > 0) {
      console.log(`Found ${recentEmails.length} recent emails to check for bounces`);
      
      // Group by sender
      const emailsBySender = new Map<string, typeof recentEmails>();
      for (const email of recentEmails) {
        const existing = emailsBySender.get(email.sender_email) || [];
        existing.push(email);
        emailsBySender.set(email.sender_email, existing);
      }
      
      for (const [senderEmail, emails] of emailsBySender.entries()) {
        // Skip if we already fetched NDRs for this sender
        if (processedSenders.has(senderEmail)) {
          // But still check against the cached NDRs would require refactoring
          // For now, skip to avoid duplicate API calls
          continue;
        }
        
        const ndrs = await fetchNDRsForSender(accessToken, senderEmail, sinceDate);
        console.log(`Found ${ndrs.length} NDRs for ${senderEmail} (general sync)`);
        
        for (const email of emails) {
          const matchingNDR = ndrs.find(ndr => 
            ndr.recipientEmail?.toLowerCase() === email.recipient_email.toLowerCase()
          );
          
          if (matchingNDR) {
            console.log(`✅ MATCH (general)! Found bounce for ${email.recipient_email}`);
            
            const { error } = await supabase
              .from('email_history')
              .update({
                status: 'bounced',
                bounce_type: 'hard',
                bounce_reason: matchingNDR.reason || 'Email delivery failed',
                bounced_at: matchingNDR.receivedDateTime || new Date().toISOString(),
                open_count: 0,
                unique_opens: 0,
                opened_at: null,
                is_valid_open: false,
              })
              .eq('id', email.id);

            if (!error) {
              generalBouncesFound++;
            }
          }
        }
      }
    }

    // 3. Clean up old pending checks (older than 7 days)
    await supabase
      .from('pending_bounce_checks')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const totalBouncesFound = pendingBouncesFound + generalBouncesFound;
    const processingTime = Date.now() - startTime;

    console.log("=".repeat(50));
    console.log(`Bounce check complete in ${processingTime}ms. Found ${totalBouncesFound} bounce(s).`);
    console.log("=".repeat(50));

    return new Response(JSON.stringify({
      success: true,
      pendingChecksProcessed: processedPendingIds.length,
      pendingBouncesFound,
      generalBouncesFound,
      totalBouncesFound,
      processingTimeMs: processingTime,
      message: totalBouncesFound > 0 
        ? `Found and marked ${totalBouncesFound} bounced email(s)` 
        : 'No new bounces detected',
      hint: totalBouncesFound === 0 && processedPendingIds.length === 0
        ? "If bounces exist but weren't detected, ensure the Azure app has 'Mail.Read' APPLICATION permission with admin consent"
        : undefined
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error processing bounces:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
