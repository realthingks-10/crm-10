import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
}

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  toName?: string;
  from: string;
  attachments?: EmailAttachment[];
  entityType?: string; // 'lead', 'contact', 'account'
  entityId?: string;
  // Threading fields
  parentEmailId?: string; // The email being replied to
  threadId?: string; // Thread grouping ID
  isReply?: boolean; // Whether this is a reply
  parentMessageId?: string; // Internet Message-ID of parent for email headers
  parentConversationId?: string; // Outlook conversation ID for proper threading
}

async function getAccessToken(): Promise<string> {
  // Use email-specific Azure credentials
  const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID");
  const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure email credentials not configured. Please set AZURE_EMAIL_TENANT_ID, AZURE_EMAIL_CLIENT_ID, and AZURE_EMAIL_CLIENT_SECRET.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  console.log("Requesting access token from Azure AD...");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to get access token:", errorText);
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("Successfully obtained access token");
  return data.access_token as string;
}

// Wrap email content with proper inline styles to match Outlook formatting exactly
function wrapEmailContent(htmlBody: string): string {
  let processed = htmlBody;
  
  // Step 1: Convert Quill alignment classes to inline styles BEFORE removing classes
  processed = processed.replace(/class="([^"]*ql-align-center[^"]*)"/gi, (match, classes) => {
    const remaining = classes.replace(/ql-align-center/gi, '').trim();
    return remaining ? `class="${remaining}" style="text-align: center;"` : 'style="text-align: center;"';
  });
  processed = processed.replace(/class="([^"]*ql-align-right[^"]*)"/gi, (match, classes) => {
    const remaining = classes.replace(/ql-align-right/gi, '').trim();
    return remaining ? `class="${remaining}" style="text-align: right;"` : 'style="text-align: right;"';
  });
  processed = processed.replace(/class="([^"]*ql-align-justify[^"]*)"/gi, (match, classes) => {
    const remaining = classes.replace(/ql-align-justify/gi, '').trim();
    return remaining ? `class="${remaining}" style="text-align: justify;"` : 'style="text-align: justify;"';
  });
  
  // Step 2: Convert Quill font classes to inline styles
  const fontMappings: Record<string, string> = {
    'ql-font-arial': "font-family: Arial, Helvetica, sans-serif;",
    'ql-font-times-new-roman': "font-family: 'Times New Roman', Times, serif;",
    'ql-font-georgia': "font-family: Georgia, serif;",
    'ql-font-verdana': "font-family: Verdana, Geneva, sans-serif;",
    'ql-font-courier-new': "font-family: 'Courier New', Courier, monospace;",
    'ql-font-trebuchet-ms': "font-family: 'Trebuchet MS', sans-serif;",
  };
  
  for (const [className, style] of Object.entries(fontMappings)) {
    const regex = new RegExp(`class="([^"]*${className}[^"]*)"`, 'gi');
    processed = processed.replace(regex, (match, classes) => {
      const remaining = classes.replace(new RegExp(className, 'gi'), '').trim();
      return remaining ? `class="${remaining}" style="${style}"` : `style="${style}"`;
    });
  }
  
  // Step 3: Convert Quill size classes to inline styles
  const sizeMappings: Record<string, string> = {
    'ql-size-small': 'font-size: 10pt;',
    'ql-size-large': 'font-size: 14pt;',
    'ql-size-huge': 'font-size: 18pt;',
  };
  
  for (const [className, style] of Object.entries(sizeMappings)) {
    const regex = new RegExp(`class="([^"]*${className}[^"]*)"`, 'gi');
    processed = processed.replace(regex, (match, classes) => {
      const remaining = classes.replace(new RegExp(className, 'gi'), '').trim();
      return remaining ? `class="${remaining}" style="${style}"` : `style="${style}"`;
    });
  }
  
  // Step 4: Remove any remaining ql-* classes
  processed = processed.replace(/class="ql-[^"]*"/gi, '');
  processed = processed.replace(/class=""/gi, '');
  
  // Step 5: Style all paragraphs uniformly (handle p with any attributes)
  // First handle p tags with existing style attribute - merge our styles
  processed = processed.replace(/<p([^>]*)\s+style="([^"]*)"([^>]*)>/gi, (match, before, existingStyle, after) => {
    return `<p${before} style="margin: 0; padding: 0; line-height: 1.15; ${existingStyle}"${after}>`;
  });
  // Then handle p tags with other attributes but no style
  processed = processed.replace(/<p(\s+[^>]*[^\/])>/gi, (match, attrs) => {
    if (attrs.includes('style=')) return match; // Already processed
    return `<p${attrs} style="margin: 0; padding: 0; line-height: 1.15;">`;
  });
  // Handle plain <p> tags
  processed = processed.replace(/<p>/gi, '<p style="margin: 0; padding: 0; line-height: 1.15;">');
  
  // Step 6: Handle empty paragraphs (Quill's line breaks) - minimal height spacer
  processed = processed.replace(/<p[^>]*><br\s*\/?><\/p>/gi, '<p style="margin: 0; padding: 0; line-height: 0.5; font-size: 8pt;">&nbsp;</p>');
  
  // Step 7: Style lists properly (keep semantic ul/ol/li with Outlook-friendly styles)
  processed = processed.replace(/<ul[^>]*>/gi, '<ul style="margin: 0 0 0 0; padding: 0 0 0 25px; list-style-type: disc; list-style-position: outside;">');
  processed = processed.replace(/<ol[^>]*>/gi, '<ol style="margin: 0 0 0 0; padding: 0 0 0 25px; list-style-type: decimal; list-style-position: outside;">');
  processed = processed.replace(/<li[^>]*>/gi, '<li style="margin: 0; padding: 0; line-height: 1.15;">');
  
  // Step 8: Style headers compactly
  processed = processed.replace(/<h1[^>]*>/gi, '<h1 style="margin: 0 0 8px 0; padding: 0; font-size: 16pt; font-weight: bold; line-height: 1.15;">');
  processed = processed.replace(/<h2[^>]*>/gi, '<h2 style="margin: 0 0 6px 0; padding: 0; font-size: 14pt; font-weight: bold; line-height: 1.15;">');
  processed = processed.replace(/<h3[^>]*>/gi, '<h3 style="margin: 0 0 4px 0; padding: 0; font-size: 12pt; font-weight: bold; line-height: 1.15;">');
  
  // Step 9: Clean br tags
  processed = processed.replace(/<br\s*\/?>/gi, '<br>');

  // Return as HTML fragment with Outlook-default font (Calibri 11pt, line-height matching Outlook)
  return `<div style="font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; color: #000000;">${processed}</div>`;
}

// Rewrite links in email body to track clicks
function rewriteLinksForTracking(html: string, emailHistoryId: string, supabaseUrl: string): string {
  // Match href attributes with http/https URLs
  const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
  
  return html.replace(linkRegex, (match, url) => {
    // Don't rewrite unsubscribe links or our own tracking URLs
    if (url.includes('unsubscribe') || url.includes('track-email')) {
      return match;
    }
    
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${supabaseUrl}/functions/v1/track-email-click?id=${emailHistoryId}&url=${encodedUrl}`;
    return `href="${trackingUrl}"`;
  });
}

// Send a new email (not a reply)
async function sendNewEmail(
  accessToken: string,
  emailRequest: EmailRequest,
  emailHistoryId: string
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${emailRequest.from}/sendMail`;

  // Build attachments array for Microsoft Graph API
  const attachments =
    emailRequest.attachments?.map((att) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    })) || [];

  // Generate tracking pixel URL for open tracking
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${emailHistoryId}`;

  // Wrap the content with proper inline styles for email clients
  const wrappedBody = wrapEmailContent(emailRequest.body);

  // Rewrite links for click tracking
  const bodyWithClickTracking = rewriteLinksForTracking(wrappedBody, emailHistoryId, supabaseUrl);

  // Embed tracking pixel in email body (append to HTML content)
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  const bodyWithTracking = bodyWithClickTracking + trackingPixel;

  const emailPayload: any = {
    message: {
      subject: emailRequest.subject,
      body: {
        contentType: "HTML",
        content: bodyWithTracking,
      },
      toRecipients: [
        {
          emailAddress: {
            address: emailRequest.to,
            name: emailRequest.toName || emailRequest.to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  // Add attachments if present
  if (attachments.length > 0) {
    emailPayload.message.attachments = attachments;
    console.log(`Adding ${attachments.length} attachment(s) to email`);
  }

  console.log(
    `Sending ${emailRequest.isReply ? "reply" : "new"} email to ${emailRequest.to} with open tracking...`
  );

  const response = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send email:", errorText);
    throw new Error(`Failed to send email: ${response.status} ${errorText}`);
  }

  console.log("Email sent successfully (sendMail) with tracking embedded");
}

// Send a reply email using Microsoft Graph's direct /reply action for proper threading
// This uses POST /messages/{id}/reply which only requires Mail.Send permission
async function sendReplyEmail(
  accessToken: string,
  emailRequest: EmailRequest,
  emailHistoryId: string,
  originalGraphMessageId: string
): Promise<void> {
  const senderEmail = emailRequest.from;
  
  console.log(`Sending reply using Graph /reply action. Original message ID: ${originalGraphMessageId}`);
  
  // Generate tracking URLs
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${emailHistoryId}`;
  
  // Wrap the content with proper inline styles for email clients
  const wrappedBody = wrapEmailContent(emailRequest.body);
  
  // Rewrite links for click tracking
  const bodyWithClickTracking = rewriteLinksForTracking(wrappedBody, emailHistoryId, supabaseUrl);
  
  // Embed tracking pixel in email body
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  const bodyWithTracking = bodyWithClickTracking + trackingPixel;

  // Check if we have attachments - if so, we'll need a different approach
  const hasAttachments = emailRequest.attachments && emailRequest.attachments.length > 0;
  
  if (hasAttachments) {
    // For attachments, we need to use createReply (draft) approach
    // This requires Mail.ReadWrite permission
    console.log(`Reply has ${emailRequest.attachments!.length} attachment(s), using createReply approach`);
    await sendReplyWithAttachments(accessToken, emailRequest, emailHistoryId, originalGraphMessageId, bodyWithTracking);
    return;
  }

  // Use the direct /reply endpoint (sends immediately, only requires Mail.Send)
  // POST /users/{user}/messages/{messageId}/reply
  const replyUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${originalGraphMessageId}/reply`;
  
  console.log(`Calling direct /reply endpoint: POST ${replyUrl}`);
  
  // The /reply endpoint accepts a "message" object to customize the reply
  // and a "comment" for simple text. We use "message" for full control.
  const replyPayload = {
    message: {
      body: {
        contentType: "HTML",
        content: bodyWithTracking,
      },
      toRecipients: [
        {
          emailAddress: {
            address: emailRequest.to,
            name: emailRequest.toName || emailRequest.to,
          },
        },
      ],
    },
  };

  const response = await fetch(replyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(replyPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send reply via /reply endpoint:", errorText);
    throw new Error(`Failed to send reply: ${response.status} ${errorText}`);
  }

  console.log("Reply sent successfully via /reply endpoint with proper Outlook threading!");
}

// Send reply with attachments using createReply (draft) approach
// This requires Mail.ReadWrite permission
async function sendReplyWithAttachments(
  accessToken: string,
  emailRequest: EmailRequest,
  emailHistoryId: string,
  originalGraphMessageId: string,
  bodyWithTracking: string
): Promise<void> {
  const senderEmail = emailRequest.from;
  
  // Build attachments array for Microsoft Graph API
  const attachments = emailRequest.attachments?.map(att => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: att.name,
    contentType: att.contentType,
    contentBytes: att.contentBytes,
  })) || [];

  // Step 1: Create a reply draft using the createReply endpoint
  const createReplyUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${originalGraphMessageId}/createReply`;
  
  console.log(`Creating reply draft via: ${createReplyUrl}`);
  
  const createReplyResponse = await fetch(createReplyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      comment: "", // We'll set the body ourselves
    }),
  });

  if (!createReplyResponse.ok) {
    const errorText = await createReplyResponse.text();
    console.error("Failed to create reply draft:", errorText);
    throw new Error(`Failed to create reply draft: ${createReplyResponse.status} ${errorText}`);
  }

  const draftMessage = await createReplyResponse.json();
  const draftId = draftMessage.id;
  console.log(`Created reply draft with ID: ${draftId}`);

  // Step 2: Update the draft with our body content
  const updateUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${draftId}`;
  
  const updatePayload: any = {
    body: {
      contentType: "HTML",
      content: bodyWithTracking,
    },
    toRecipients: [
      {
        emailAddress: {
          address: emailRequest.to,
          name: emailRequest.toName || emailRequest.to,
        },
      },
    ],
  };

  const updateResponse = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error("Failed to update reply draft:", errorText);
    throw new Error(`Failed to update reply draft: ${updateResponse.status} ${errorText}`);
  }

  console.log("Updated reply draft with body content");

  // Step 3: Add attachments
  console.log(`Adding ${attachments.length} attachment(s) to reply...`);
  for (const attachment of attachments) {
    const attachmentUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${draftId}/attachments`;
    
    const attachResponse = await fetch(attachmentUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(attachment),
    });

    if (!attachResponse.ok) {
      const errorText = await attachResponse.text();
      console.warn(`Failed to add attachment ${attachment.name}:`, errorText);
    }
  }

  // Step 4: Send the draft
  const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${draftId}/send`;
  
  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!sendResponse.ok) {
    const errorText = await sendResponse.text();
    console.error("Failed to send reply draft:", errorText);
    throw new Error(`Failed to send reply: ${sendResponse.status} ${errorText}`);
  }

  console.log("Reply with attachments sent successfully via createReply/send!");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, subject, body, toName, from, attachments, entityType, entityId,
      parentEmailId, threadId, isReply, parentMessageId, parentConversationId
    }: EmailRequest = await req.json();

    if (!to || !subject || !from) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, from" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format - catch invalid emails before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanedTo = to.trim();
    if (!emailRegex.test(cleanedTo)) {
      console.error(`Invalid email format detected: ${to}`);
      return new Response(
        JSON.stringify({ error: `Invalid email address format: ${to}. Please check for spaces or invalid characters.` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Processing email request from ${from} to: ${cleanedTo}${attachments?.length ? ` with ${attachments.length} attachment(s)` : ''}${isReply ? ' (REPLY)' : ''}`);

    // Create Supabase client for storing email history
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user ID from the authorization header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Determine thread_id for threading
    // If this is a reply, use the provided threadId or parentEmailId
    // If it's a new email, thread_id will be set to the new email's own ID after creation
    let resolvedThreadId = threadId || parentEmailId || null;

    // If parentEmailId is provided, fetch the parent's message_id and conversation_id for threading
    let resolvedParentMessageId = parentMessageId;
    let resolvedParentConversationId: string | null = parentConversationId || null;
    if (parentEmailId && (!resolvedParentMessageId || !resolvedParentConversationId)) {
      const { data: parentEmail } = await supabase
        .from("email_history")
        .select("message_id, thread_id, conversation_id")
        .eq("id", parentEmailId)
        .single();
      
      if (parentEmail) {
        if (!resolvedParentMessageId) {
          resolvedParentMessageId = parentEmail.message_id;
        }
        if (!resolvedParentConversationId) {
          resolvedParentConversationId = parentEmail.conversation_id || null;
        }
        // Use parent's thread_id if available
        if (parentEmail.thread_id && !resolvedThreadId) {
          resolvedThreadId = parentEmail.thread_id;
        }
      }
    }

    // Create email history record first to get the ID for tracking
    const emailHistoryData: any = {
      recipient_email: to,
      recipient_name: toName || to,
      sender_email: from,
      subject: subject,
      body: body,
      status: "sent",
      sent_by: userId,
      is_valid_open: true,
      // Threading fields
      parent_email_id: parentEmailId || null,
      is_reply: isReply || false,
    };

    // Add entity references if provided
    if (entityType === "lead" && entityId) {
      emailHistoryData.lead_id = entityId;
    } else if (entityType === "contact" && entityId) {
      emailHistoryData.contact_id = entityId;
    } else if (entityType === "account" && entityId) {
      emailHistoryData.account_id = entityId;
    }

    // If this is a reply, copy entity refs from parent if not provided
    if (isReply && parentEmailId && !entityId) {
      const { data: parentEmail } = await supabase
        .from("email_history")
        .select("lead_id, contact_id, account_id")
        .eq("id", parentEmailId)
        .single();
      
      if (parentEmail) {
        if (parentEmail.lead_id) emailHistoryData.lead_id = parentEmail.lead_id;
        if (parentEmail.contact_id) emailHistoryData.contact_id = parentEmail.contact_id;
        if (parentEmail.account_id) emailHistoryData.account_id = parentEmail.account_id;
      }
    }

    const { data: emailRecord, error: insertError } = await supabase
      .from("email_history")
      .insert(emailHistoryData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create email history record:", insertError);
      throw new Error(`Failed to create email history: ${insertError.message}`);
    }

    console.log(`Created email history record with ID: ${emailRecord.id}${isReply ? ` (reply to ${parentEmailId})` : ''}`);

    // Set thread_id: for new emails, use own ID; for replies, use resolved thread ID
    const finalThreadId = resolvedThreadId || emailRecord.id;
    
    // Update the record with thread_id
    await supabase
      .from("email_history")
      .update({ thread_id: finalThreadId })
      .eq("id", emailRecord.id);

    console.log(`Set thread_id to: ${finalThreadId}`);

    // Get access token from Azure AD
    const accessToken = await getAccessToken();

    // Determine if we can use the reply endpoint
    // We need the Graph message ID (not internet message ID) to use reply endpoint
    let graphMessageId: string | null = null;
    
    if (isReply && (resolvedParentMessageId || resolvedParentConversationId)) {
      // Try to find the original message by internet message ID first
      console.log(`Looking for original message. MessageID: ${resolvedParentMessageId}, ConversationID: ${resolvedParentConversationId}`);

      try {
        // Helper function to search messages in a specific folder or all messages
        const searchMessages = async (baseUrl: string, folderName: string) => {
          const response = await fetch(baseUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (response.ok) {
            const data = await response.json();
            if (data.value && data.value.length > 0) {
              console.log(`Found message in ${folderName}: ${data.value[0].id}`);
              return data.value[0].id;
            }
          } else {
            console.warn(`Failed to search in ${folderName}: ${response.status}`);
          }
          return null;
        };

        // Strategy 1: Search by internetMessageId (most accurate)
        if (resolvedParentMessageId) {
          const safeInternetMessageId = resolvedParentMessageId.replace(/'/g, "''");
          const qs = new URLSearchParams({
            "$filter": `internetMessageId eq '${safeInternetMessageId}'`,
            "$select": "id,internetMessageId,conversationId",
          });
          
          // First try all messages (includes inbox)
          const allMessagesUrl = `https://graph.microsoft.com/v1.0/users/${from}/messages?${qs.toString()}`;
          graphMessageId = await searchMessages(allMessagesUrl, "all messages");
          
          // If not found, try Sent Items folder explicitly (sent emails are stored here)
          if (!graphMessageId) {
            console.log("Not found in inbox, trying Sent Items folder...");
            const sentItemsUrl = `https://graph.microsoft.com/v1.0/users/${from}/mailFolders/SentItems/messages?${qs.toString()}`;
            graphMessageId = await searchMessages(sentItemsUrl, "SentItems");
          }
          
          if (graphMessageId) {
            console.log(`Found Graph message ID via internetMessageId: ${graphMessageId}`);
          }
        }

        // Strategy 2: If not found, search by conversationId (Outlook's threading key)
        if (!graphMessageId && resolvedParentConversationId) {
          console.log(`Trying to find message by conversationId: ${resolvedParentConversationId}`);
          const convQs = new URLSearchParams({
            "$filter": `conversationId eq '${resolvedParentConversationId}'`,
            "$orderby": "receivedDateTime desc",
            "$top": "1",
            "$select": "id,internetMessageId,conversationId",
          });
          
          // First try all messages (includes inbox)
          const convAllUrl = `https://graph.microsoft.com/v1.0/users/${from}/messages?${convQs.toString()}`;
          graphMessageId = await searchMessages(convAllUrl, "all messages (conversationId)");
          
          // If not found, try Sent Items folder
          if (!graphMessageId) {
            console.log("Not found in inbox by conversationId, trying Sent Items folder...");
            const convSentUrl = `https://graph.microsoft.com/v1.0/users/${from}/mailFolders/SentItems/messages?${convQs.toString()}`;
            graphMessageId = await searchMessages(convSentUrl, "SentItems (conversationId)");
          }
          
          if (graphMessageId) {
            console.log(`Found Graph message ID via conversationId: ${graphMessageId}`);
          } else {
            console.log("No messages found by conversationId in any folder");
          }
        }

        if (!graphMessageId) {
          console.log("Original message not found in any mailbox folder, will send as new email");
        }
      } catch (searchError) {
        console.warn("Error searching for original message:", searchError);
      }
    }

    // Send email - use reply endpoint if we have the Graph message ID, otherwise send as new
    const effectiveSubject = isReply
      ? subject.toLowerCase().startsWith("re:")
        ? subject
        : `Re: ${subject}`
      : subject;

    if (isReply && graphMessageId) {
      console.log("Using Graph /reply action for proper threading");
      try {
        await sendReplyEmail(
          accessToken,
          {
            to,
            subject: effectiveSubject,
            body,
            toName,
            from,
            attachments,
            isReply,
            parentMessageId: resolvedParentMessageId,
          },
          emailRecord.id,
          graphMessageId
        );
      } catch (replyError: any) {
        // Check if this is a permission error
        const errorMsg = replyError.message || '';
        const isAccessDenied = errorMsg.includes("403") || errorMsg.includes("AccessDenied") || errorMsg.includes("Forbidden");
        
        if (isAccessDenied) {
          console.error("=".repeat(60));
          console.error("⚠️ Graph Reply API returned AccessDenied (403)");
          console.error("This typically means missing Mail.Send or Mail.ReadWrite permission.");
          console.error("For replies WITHOUT attachments: only Mail.Send is needed.");
          console.error("For replies WITH attachments: Mail.ReadWrite is also needed.");
          console.error("=".repeat(60));
          console.warn(
            "Falling back to sendMail - reply will be sent but may NOT appear in same Outlook thread."
          );

          await sendNewEmail(
            accessToken,
            {
              to,
              subject: effectiveSubject,
              body,
              toName,
              from,
              attachments,
              isReply,
              parentMessageId: resolvedParentMessageId,
            },
            emailRecord.id
          );
        } else {
          throw replyError;
        }
      }
    } else {
      if (isReply) {
        console.log(
          "Could not use Graph Reply API (missing Graph message id). Sending via sendMail."
        );
      }
      await sendNewEmail(
        accessToken,
        {
          to,
          subject: effectiveSubject,
          body,
          toName,
          from,
          attachments,
          isReply,
          parentMessageId: resolvedParentMessageId,
        },
        emailRecord.id
      );
    }

    // Fetch the sent message to get its Message-ID and conversationId for threading
    let messageId: string | null = null;
    let conversationId: string | null = null;
    let retries = 0;
    const maxRetries = 4;

    while (!messageId && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000 + (retries * 1000)));
      retries++;
      
      try {
        // Include conversationId in the select to capture it for threading
        const sentItemsUrl = `https://graph.microsoft.com/v1.0/users/${from}/mailFolders/SentItems/messages?$top=10&$orderby=sentDateTime desc&$select=internetMessageId,subject,sentDateTime,toRecipients,conversationId`;
        
        const sentResponse = await fetch(sentItemsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (sentResponse.ok) {
          const sentData = await sentResponse.json();
          const messages = sentData.value || [];
          
          const recentMessages = messages.filter((msg: any) => {
            const msgTime = new Date(msg.sentDateTime);
            const timeDiff = Date.now() - msgTime.getTime();
            return timeDiff < 90000;
          });

          console.log(`Attempt ${retries}: Found ${recentMessages.length} recent messages in sent folder`);

          if (recentMessages.length === 1) {
            messageId = recentMessages[0].internetMessageId;
            conversationId = recentMessages[0].conversationId || null;
            console.log(`Single recent email - captured Message-ID on attempt ${retries}: ${messageId}, conversationId: ${conversationId}`);
            break;
          }

          for (const msg of recentMessages) {
            const msgRecipients = msg.toRecipients || [];
            const recipientMatch = msgRecipients.some((r: any) => 
              r.emailAddress?.address?.toLowerCase() === cleanedTo.toLowerCase()
            );
            
            if (recipientMatch) {
              const normalizeSubject = (s: string) => 
                s.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
              
              const normalizedSubject = normalizeSubject(subject);
              const normalizedMsgSubject = normalizeSubject(msg.subject || '');
              
              const subjectSimilar = 
                normalizedSubject.substring(0, 15) === normalizedMsgSubject.substring(0, 15) ||
                normalizedSubject.includes(normalizedMsgSubject.substring(0, 15)) ||
                normalizedMsgSubject.includes(normalizedSubject.substring(0, 15)) ||
                msg.subject === subject;
              
              if (subjectSimilar || recentMessages.length <= 2) {
                messageId = msg.internetMessageId;
                conversationId = msg.conversationId || null;
                console.log(`Matched by recipient + subject on attempt ${retries}: ${messageId}, conversationId: ${conversationId}`);
                break;
              }
            }
          }

          if (!messageId) {
            for (const msg of recentMessages) {
              if (msg.subject === subject) {
                messageId = msg.internetMessageId;
                conversationId = msg.conversationId || null;
                console.log(`Matched by exact subject on attempt ${retries}: ${messageId}, conversationId: ${conversationId}`);
                break;
              }
            }
          }
        } else {
          console.warn(`Failed to fetch sent items (attempt ${retries}): ${sentResponse.status}`);
        }
      } catch (msgIdError) {
        console.warn(`Failed to capture Message-ID (attempt ${retries}):`, msgIdError);
      }
    }

    if (!messageId) {
      console.warn(`Could not capture Message-ID for email to ${cleanedTo} after ${maxRetries} attempts`);
    } else {
      console.log(`Successfully captured Message-ID: ${messageId}${conversationId ? `, conversationId: ${conversationId}` : ''}`);
    }

    // Update email history with Message-ID and conversationId
    await supabase
      .from("email_history")
      .update({ 
        status: "sent",
        is_valid_open: true,
        message_id: messageId,
        conversation_id: conversationId,
      })
      .eq("id", emailRecord.id);

    console.log(`Email marked as sent for record: ${emailRecord.id}${messageId ? ` with Message-ID: ${messageId}` : ' (no Message-ID captured)'}`);

    // Queue a bounce check for 45 seconds from now
    const checkAfter = new Date(Date.now() + 45000).toISOString();
    const { error: queueError } = await supabase
      .from("pending_bounce_checks")
      .insert({
        email_history_id: emailRecord.id,
        sender_email: from,
        recipient_email: to,
        check_after: checkAfter,
      });

    if (queueError) {
      console.warn("Failed to queue bounce check:", queueError);
    } else {
      console.log(`Queued bounce check for ${to} at ${checkAfter}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        emailId: emailRecord.id,
        threadId: finalThreadId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
