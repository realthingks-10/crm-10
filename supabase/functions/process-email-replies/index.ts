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

interface ReplyInfo {
  from_email: string;
  from_name: string | null;
  subject: string;
  body_preview: string;
  received_at: string;
  graph_message_id: string;
  in_reply_to: string | null;
  conversation_id: string | null;
}

async function fetchInboxReplies(
  accessToken: string,
  senderEmail: string,
  sinceDate: string
): Promise<ReplyInfo[]> {
  const replies: ReplyInfo[] = [];
  const senderEmailLower = senderEmail.toLowerCase();
  
  try {
    // Fetch recent messages from inbox with headers AND recipients
    // Added toRecipients and ccRecipients to verify the message was sent TO this mailbox
    const searchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/mailFolders/Inbox/messages?$filter=receivedDateTime ge ${sinceDate}&$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,internetMessageHeaders,conversationId&$top=100&$orderby=receivedDateTime desc`;

    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch inbox for ${senderEmail}: ${response.status} - ${errorText.substring(0, 200)}`);
      return replies;
    }

    const messagesData = await response.json();
    const messages = messagesData.value || [];
    
    console.log(`Processing ${messages.length} inbox messages for ${senderEmail}`);
    
    for (const msg of messages) {
      const fromEmail = (msg.from?.emailAddress?.address || '').toLowerCase();
      
      // CRITICAL FIX: Skip self-sent messages (sent by the same mailbox owner)
      // This prevents treating our own sent emails as "received" replies
      if (fromEmail === senderEmailLower) {
        console.log(`⏭️ Skipping self-sent message: ${msg.subject?.substring(0, 50)}`);
        continue;
      }
      
      // Verify the message was addressed TO this mailbox (not just in inbox due to forwarding/rules)
      const toRecipients = msg.toRecipients || [];
      const ccRecipients = msg.ccRecipients || [];
      const allRecipients = [...toRecipients, ...ccRecipients];
      const isAddressedToSender = allRecipients.some(
        (r: any) => r.emailAddress?.address?.toLowerCase() === senderEmailLower
      );
      
      if (!isAddressedToSender) {
        console.log(`⏭️ Skipping message not addressed to ${senderEmail}: ${msg.subject?.substring(0, 50)}`);
        continue;
      }
      
      // Look for In-Reply-To or References header
      const headers = msg.internetMessageHeaders || [];
      const inReplyTo = headers.find((h: any) => h.name.toLowerCase() === 'in-reply-to')?.value;
      const references = headers.find((h: any) => h.name.toLowerCase() === 'references')?.value;
      
      // Get the conversationId for fallback matching
      const conversationId = msg.conversationId || null;
      
      // Require reply headers (In-Reply-To or References) to identify as a reply
      // Only use conversationId as fallback if subject starts with "Re:" or "RE:"
      const hasReplyHeaders = !!inReplyTo || !!references;
      const hasReSubject = msg.subject && /^re:/i.test(msg.subject.trim());
      
      if (!hasReplyHeaders && !conversationId) {
        console.log(`⏭️ Skipping non-reply message (no headers, no conversationId): ${msg.subject?.substring(0, 50)}`);
        continue;
      }
      
      // If no reply headers but has conversationId, only include if subject starts with "Re:"
      if (!hasReplyHeaders && conversationId && !hasReSubject) {
        console.log(`⏭️ Skipping message with conversationId but no Re: subject: ${msg.subject?.substring(0, 50)}`);
        continue;
      }
      
      // Extract the message ID being replied to
      let replyToMessageId = inReplyTo;
      if (!replyToMessageId && references) {
        // References header contains space-separated list of message IDs, take the last one
        const refList = references.split(/\s+/);
        replyToMessageId = refList[refList.length - 1];
      }
      
      // Clean the message ID (remove angle brackets if present)
      if (replyToMessageId) {
        replyToMessageId = replyToMessageId.replace(/^<|>$/g, '');
      }
      
      console.log(`✅ Valid reply candidate from ${fromEmail}: ${msg.subject?.substring(0, 50)}`);
      
      replies.push({
        from_email: msg.from?.emailAddress?.address || '',
        from_name: msg.from?.emailAddress?.name || null,
        subject: msg.subject || '',
        body_preview: (msg.bodyPreview || '').substring(0, 500),
        received_at: msg.receivedDateTime,
        graph_message_id: msg.id,
        in_reply_to: replyToMessageId || null,
        conversation_id: conversationId,
      });
    }
  } catch (error) {
    console.error(`Error fetching inbox for ${senderEmail}:`, error);
  }
  
  return replies;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log("Starting email reply check process...");
  console.log("=".repeat(50));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log("Successfully obtained Azure access token");
    } catch (tokenError) {
      console.error("Failed to get access token:", tokenError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Azure authentication failed",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails sent in the last 30 days that have a message_id and haven't been replied to yet
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`Searching for emails with message_id since: ${sinceDate}`);
    
    const { data: sentEmails, error: sentError } = await supabase
      .from('email_history')
      .select('id, sender_email, recipient_email, subject, message_id, conversation_id, sent_by, reply_count, sent_at')
      .gte('sent_at', sinceDate)
      .not('status', 'eq', 'bounced')
      .order('sent_at', { ascending: false });

    if (sentError) {
      console.error("Error fetching sent emails:", sentError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch sent emails",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also log emails without message_id for debugging
    const { data: emailsWithoutMsgId } = await supabase
      .from('email_history')
      .select('id, recipient_email, subject')
      .gte('sent_at', sinceDate)
      .is('message_id', null)
      .not('status', 'eq', 'bounced');
    
    console.log(`Emails WITH message_id: ${sentEmails?.length || 0}`);
    console.log(`Emails WITHOUT message_id: ${emailsWithoutMsgId?.length || 0}`);

    if (!sentEmails || sentEmails.length === 0) {
      console.log("No emails with message_id found to check for replies");
      return new Response(JSON.stringify({
        success: true,
        message: "No emails to check for replies",
        repliesFound: 0,
        emailsWithoutMessageId: emailsWithoutMsgId?.length || 0,
        hint: emailsWithoutMsgId && emailsWithoutMsgId.length > 0 
          ? `Found ${emailsWithoutMsgId.length} emails without message_id - these cannot be tracked for replies`
          : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${sentEmails.length} emails to check for replies`);

    // Group by sender email
    const emailsBySender = new Map<string, typeof sentEmails>();
    for (const email of sentEmails) {
      const existing = emailsBySender.get(email.sender_email) || [];
      existing.push(email);
      emailsBySender.set(email.sender_email, existing);
    }

    let totalRepliesFound = 0;
    let skippedSelfReplies = 0;
    const processedReplies: string[] = [];

    for (const [senderEmail, emails] of emailsBySender.entries()) {
      console.log(`Checking replies for ${senderEmail} (${emails.length} sent emails)`);
      
      const replies = await fetchInboxReplies(accessToken, senderEmail, sinceDate);
      console.log(`Found ${replies.length} valid reply candidates in inbox`);
      
      // Create maps for quick lookup
      const messageIdToEmail = new Map<string, typeof emails[0]>();
      const conversationIdToEmail = new Map<string, typeof emails[0]>();
      
      for (const email of emails) {
        if (email.message_id) {
          // Store both with and without angle brackets
          messageIdToEmail.set(email.message_id, email);
          messageIdToEmail.set(email.message_id.replace(/^<|>$/g, ''), email);
        }
        // Also index by conversation_id for fallback matching
        if (email.conversation_id) {
          conversationIdToEmail.set(email.conversation_id, email);
        }
      }
      
      for (const reply of replies) {
        let originalEmail: typeof emails[0] | undefined = undefined;
        
        // First, try to match by In-Reply-To message ID (most reliable)
        if (reply.in_reply_to) {
          console.log(`Trying to match reply In-Reply-To: ${reply.in_reply_to}`);
          
          originalEmail = messageIdToEmail.get(reply.in_reply_to);
          
          if (!originalEmail) {
            // Try with angle brackets
            originalEmail = messageIdToEmail.get(`<${reply.in_reply_to}>`);
          }
          
          if (!originalEmail) {
            // Try without angle brackets
            const cleanedId = reply.in_reply_to.replace(/^<|>$/g, '');
            originalEmail = messageIdToEmail.get(cleanedId);
          }
        }
        
        // Fallback: Match by conversationId if In-Reply-To matching failed
        if (!originalEmail && reply.conversation_id) {
          console.log(`Fallback: Trying to match by conversationId: ${reply.conversation_id}`);
          originalEmail = conversationIdToEmail.get(reply.conversation_id);
          
          if (originalEmail) {
            console.log(`✅ Matched via conversationId to email: ${originalEmail.id}`);
          }
        }
        
        if (originalEmail) {
          console.log(`✅ Found matching email: ${originalEmail.id}`);
        } else if (reply.in_reply_to || reply.conversation_id) {
          console.log(`❌ No match found for In-Reply-To: ${reply.in_reply_to}, conversationId: ${reply.conversation_id}`);
        }
        
        if (originalEmail) {
          // CRITICAL SAFETY CHECK: Never insert a reply where from_email equals sender_email
          // This is a final guard against self-replies
          if (reply.from_email.toLowerCase() === originalEmail.sender_email.toLowerCase()) {
            console.log(`🚫 BLOCKED: Self-reply detected - from: ${reply.from_email}, sender: ${originalEmail.sender_email}`);
            skippedSelfReplies++;
            continue;
          }
          
          // Check if we already have this reply
          const { data: existingReply } = await supabase
            .from('email_replies')
            .select('id')
            .eq('email_history_id', originalEmail.id)
            .eq('graph_message_id', reply.graph_message_id)
            .single();
          
          if (existingReply) {
            console.log(`Reply already recorded for email ${originalEmail.id}`);
            continue;
          }
          
          console.log(`✅ MATCH! Found reply to email ${originalEmail.id} from ${reply.from_email}`);
          
          // Insert the reply record
          const { error: insertError } = await supabase
            .from('email_replies')
            .insert({
              email_history_id: originalEmail.id,
              from_email: reply.from_email,
              from_name: reply.from_name,
              subject: reply.subject,
              body_preview: reply.body_preview,
              received_at: reply.received_at,
              graph_message_id: reply.graph_message_id,
            });
          
          if (insertError) {
            console.error(`Failed to insert reply:`, insertError);
            continue;
          }
          
          // Update the email_history with reply info
          const currentReplyCount = originalEmail.reply_count || 0;
          const isFirstReply = currentReplyCount === 0;
          
          const updateData: any = {
            reply_count: currentReplyCount + 1,
            last_reply_at: reply.received_at,
            status: 'replied',
          };
          
          if (isFirstReply) {
            updateData.replied_at = reply.received_at;
          }
          
          const { error: updateError } = await supabase
            .from('email_history')
            .update(updateData)
            .eq('id', originalEmail.id);
          
          if (updateError) {
            console.error(`Failed to update email history:`, updateError);
            continue;
          }
          
          // Create notification for the sender
          if (originalEmail.sent_by) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: originalEmail.sent_by,
                message: `${reply.from_name || reply.from_email} replied to your email: "${originalEmail.subject}"`,
                notification_type: 'email_replied',
                status: 'unread',
              });
            
            if (notifError) {
              console.warn(`Failed to create reply notification:`, notifError);
            }
          }
          
          totalRepliesFound++;
          processedReplies.push(originalEmail.id);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    console.log("=".repeat(50));
    console.log(`Reply check complete in ${processingTime}ms. Found ${totalRepliesFound} new reply(s). Blocked ${skippedSelfReplies} self-replies.`);
    console.log("=".repeat(50));

    return new Response(JSON.stringify({
      success: true,
      emailsChecked: sentEmails.length,
      repliesFound: totalRepliesFound,
      skippedSelfReplies,
      processedReplies,
      processingTimeMs: processingTime,
      message: totalRepliesFound > 0 
        ? `Found ${totalRepliesFound} new reply(s)` 
        : 'No new replies detected',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error processing replies:", error);
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
