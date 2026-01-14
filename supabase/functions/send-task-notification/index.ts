import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Azure Graph API email functions
async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID");
  const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure email credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Azure token error:", errorText);
    throw new Error(`Failed to get Azure access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendEmailViaGraph(
  accessToken: string,
  to: string,
  toName: string,
  subject: string,
  body: string,
  from: string
): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${from}/sendMail`;

  const emailPayload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
            name: toName || to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

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
    console.error("Graph API error:", errorText);
    throw new Error(`Failed to send email via Graph API: ${response.status}`);
  }
}

type NotificationType = "task_assigned" | "task_unassigned" | "status_in_progress" | "status_completed" | "status_cancelled" | "status_open";

interface TaskNotificationRequest {
  taskId: string;
  notificationType: NotificationType;
  recipientUserId: string;
  senderUserId: string; // The user who performed the action
  taskTitle: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskPriority?: string;
  updatedByName?: string;
  assigneeName?: string;
}

const getEmailSubject = (type: NotificationType, taskTitle: string): string => {
  switch (type) {
    case "task_assigned":
      return `📋 New Task Assigned: ${taskTitle}`;
    case "task_unassigned":
      return `📋 Task Reassigned: ${taskTitle}`;
    case "status_in_progress":
      return `🔄 Task In Progress: ${taskTitle}`;
    case "status_completed":
      return `✅ Task Completed: ${taskTitle}`;
    case "status_cancelled":
      return `❌ Task Cancelled: ${taskTitle}`;
    case "status_open":
      return `📝 Task Reopened: ${taskTitle}`;
    default:
      return `📋 Task Update: ${taskTitle}`;
  }
};

const getEmailContent = (
  type: NotificationType,
  taskTitle: string,
  recipientName: string,
  taskDescription: string | undefined,
  taskDueDate: string | undefined,
  taskPriority: string | undefined,
  updatedByName: string | undefined,
  assigneeName: string | undefined,
  appUrl: string
): { heading: string; message: string; color: string } => {
  switch (type) {
    case "task_assigned":
      return {
        heading: "New Task Assigned to You",
        message: `<strong>${updatedByName || "Someone"}</strong> has assigned you a new task.`,
        color: "#3b82f6",
      };
    case "task_unassigned":
      return {
        heading: "Task Reassigned",
        message: `<strong>${updatedByName || "Someone"}</strong> has reassigned this task to another user.`,
        color: "#6b7280",
      };
    case "status_in_progress":
      return {
        heading: "Task Status Updated",
        message: `<strong>${updatedByName || "Someone"}</strong> has started working on this task.`,
        color: "#f59e0b",
      };
    case "status_completed":
      return {
        heading: "Task Completed! 🎉",
        message: `<strong>${updatedByName || "Someone"}</strong> has completed this task.`,
        color: "#22c55e",
      };
    case "status_cancelled":
      return {
        heading: "Task Cancelled",
        message: `<strong>${updatedByName || "Someone"}</strong> has cancelled this task.`,
        color: "#ef4444",
      };
    case "status_open":
      return {
        heading: "Task Reopened",
        message: `<strong>${updatedByName || "Someone"}</strong> has reopened this task.`,
        color: "#6366f1",
      };
    default:
      return {
        heading: "Task Update",
        message: "A task has been updated.",
        color: "#3b82f6",
      };
  }
};

const generateEmailHtml = (
  type: NotificationType,
  taskTitle: string,
  recipientName: string,
  taskDescription: string | undefined,
  taskDueDate: string | undefined,
  taskPriority: string | undefined,
  updatedByName: string | undefined,
  assigneeName: string | undefined,
  appUrl: string,
  taskId: string
): string => {
  const { heading, message, color } = getEmailContent(
    type, taskTitle, recipientName, taskDescription, taskDueDate, taskPriority, updatedByName, assigneeName, appUrl
  );

  const priorityColors: Record<string, string> = {
    high: "#ef4444",
    medium: "#eab308",
    low: "#22c55e",
  };

  const formattedDueDate = taskDueDate
    ? new Date(taskDueDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${color}, ${color}dd); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">${heading}</h1>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
        Hello, <strong>${recipientName || "there"}</strong>! 👋
      </p>

      <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px;">
        ${message}
      </p>

      <!-- Task Details Card -->
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">
          ${taskTitle}
        </h2>
        
        ${taskDescription ? `
        <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
          ${taskDescription.substring(0, 200)}${taskDescription.length > 200 ? "..." : ""}
        </p>
        ` : ""}

        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${taskPriority ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${priorityColors[taskPriority] || "#6b7280"};"></span>
            <span style="font-size: 13px; color: #4b5563; text-transform: capitalize;">${taskPriority} Priority</span>
          </div>
          ` : ""}
          
          ${formattedDueDate ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; color: #4b5563;">📅 Due: ${formattedDueDate}</span>
          </div>
          ` : ""}

          ${assigneeName && type === "task_assigned" ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; color: #4b5563;">👤 Assigned to: ${assigneeName}</span>
          </div>
          ` : ""}
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/tasks?viewId=${taskId}" style="display: inline-block; padding: 12px 32px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          View Task →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You're receiving this because of task notifications.<br>
        <a href="${appUrl}/settings" style="color: #6b7280; text-decoration: underline;">Manage notification settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      taskId,
      notificationType,
      recipientUserId,
      senderUserId,
      taskTitle,
      taskDescription,
      taskDueDate,
      taskPriority,
      updatedByName,
      assigneeName,
    }: TaskNotificationRequest = await req.json();

    console.log(`Processing task notification: ${notificationType} for task ${taskId} to user ${recipientUserId} from sender ${senderUserId}`);

    if (!taskId || !notificationType || !recipientUserId || !taskTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recipient profile
    const { data: recipientProfile, error: recipientError } = await supabase
      .from("profiles")
      .select('id, full_name, "Email ID"')
      .eq("id", recipientUserId)
      .single();

    if (recipientError || !recipientProfile) {
      console.error("Failed to fetch recipient profile:", recipientError);
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientEmail = recipientProfile["Email ID"];
    if (!recipientEmail) {
      console.log(`No email found for recipient user ${recipientUserId}`);
      return new Response(
        JSON.stringify({ success: false, message: "Recipient has no email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sender profile (the user who performed the action)
    let senderEmail = recipientEmail; // Default fallback to recipient's email
    let senderDisplayName = updatedByName || "CRM User";
    
    if (senderUserId) {
      const { data: senderProfile, error: senderError } = await supabase
        .from("profiles")
        .select('id, full_name, "Email ID"')
        .eq("id", senderUserId)
        .single();

      if (!senderError && senderProfile) {
        senderEmail = senderProfile["Email ID"] || recipientEmail;
        senderDisplayName = senderProfile.full_name || "CRM User";
        console.log(`Sender profile found: ${senderDisplayName} (${senderEmail})`);
      } else {
        console.warn(`Could not fetch sender profile for ${senderUserId}, using recipient's email as fallback`);
      }
    }

    // Check notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_notifications, task_reminders")
      .eq("user_id", recipientUserId)
      .single();

    if (prefs && (prefs.email_notifications === false || prefs.task_reminders === false)) {
      console.log(`User ${recipientUserId} has task email notifications disabled`);
      return new Response(
        JSON.stringify({ success: false, message: "User has notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://insidesales.realthingks.com";
    const emailHtml = generateEmailHtml(
      notificationType,
      taskTitle,
      recipientProfile.full_name || "",
      taskDescription,
      taskDueDate,
      taskPriority,
      senderDisplayName, // Use sender's display name
      assigneeName,
      appUrl,
      taskId
    );

    const emailSubject = getEmailSubject(notificationType, taskTitle);

    // Use the action performer's email (sender) as the from address
    // This ensures emails come from the person who made the change
    const fromEmail = senderEmail;

    console.log(`Sending email from ${fromEmail} to ${recipientEmail}`);

    // Send email directly via Azure Graph API
    const accessToken = await getAccessToken();
    await sendEmailViaGraph(
      accessToken,
      recipientEmail,
      recipientProfile.full_name || "",
      emailSubject,
      emailHtml,
      fromEmail
    );

    console.log(`Task notification email sent successfully: ${notificationType} from ${fromEmail} to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notification email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-task-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
