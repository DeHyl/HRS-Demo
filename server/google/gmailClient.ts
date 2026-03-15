import { google } from "googleapis";

export function formatCallDate(date: Date, format: "full" | "short" = "full", overrideTimezone?: string | null): string {
  const timezone = overrideTimezone || process.env.LOCAL_TIMEZONE || "America/Los_Angeles";
  
  if (format === "short") {
    return date.toLocaleDateString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
  
  return date.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isEmailConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export interface EmailOptions {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export async function sendFeedbackEmail(options: EmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    console.log("[Email] Gmail not configured - logging email for testing:");
    console.log("[Email] To:", options.to);
    if (options.cc) console.log("[Email] CC:", options.cc);
    console.log("[Email] Subject:", options.subject);
    console.log("[Email] Body preview:", options.body.substring(0, 500) + "...");
    console.log("[Email] --- Email would be sent when Gmail is configured ---");
    return;
  }

  const auth = getAuth();
  const gmail = google.gmail({ version: "v1", auth });

  const headerLines = [
    `To: ${options.to}`,
    ...(options.cc ? [`Cc: ${options.cc}`] : []),
    `Subject: ${options.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
  ].join("\r\n");

  // MIME requires exactly one blank line between headers and body
  const headers = `${headerLines}\r\n\r\n${options.body}`;

  const encodedMessage = Buffer.from(headers)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage
    }
  });
}

export function formatFeedbackEmail(
  sdrName: string,
  callDate: Date,
  action: string,
  managerSummary: string[],
  coachingMessage: string,
  timezone?: string | null
): string {
  const dateStr = formatCallDate(callDate, "full", timezone);

  const formattedCoachingMessage = coachingMessage
    .replace(/<[^>]*>/g, '')
    .replace(/"margin:[^"]*">/g, '')
    .replace(/style="[^"]*"/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\n\\n/g, '\n\n')
    .replace(/\\n/g, '\n')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return `
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 20px; }
          .container { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { background-color: #1f2937; color: #ffffff; padding: 24px 32px; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
          .header .meta { color: #9ca3af; font-size: 14px; margin-top: 8px; }
          .content { padding: 32px; }
          .coaching-message { color: #374151; font-size: 15px; line-height: 1.7; }
          .footer { padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
          .footer p { margin: 0; font-size: 12px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${action} Coaching - ${dateStr}</h1>
            <div class="meta">${sdrName}</div>
          </div>
          
          <div class="content">
            <div class="coaching-message">
              ${formattedCoachingMessage}
            </div>
          </div>
          
          <div class="footer">
            <p>Powered by Lead Intel</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export interface EmailWithAttachmentOptions {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachment: {
    filename: string;
    content: Buffer;
    contentType: string;
  };
}

export async function sendEmailWithAttachment(options: EmailWithAttachmentOptions): Promise<void> {
  const auth = getAuth();
  const gmail = google.gmail({ version: "v1", auth });

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const rawBase64 = options.attachment.content.toString("base64");
  const wrappedBase64 = rawBase64.match(/.{1,76}/g)?.join("\r\n") || rawBase64;
  
  const messageParts = [
    `To: ${options.to}`,
    options.cc ? `Cc: ${options.cc}` : "",
    `Subject: ${options.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    options.body,
    "",
    `--${boundary}`,
    `Content-Type: ${options.attachment.contentType}; name="${options.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${options.attachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    "",
    wrappedBase64,
    "",
    `--${boundary}--`
  ].filter(Boolean).join("\r\n");

  const encodedMessage = Buffer.from(messageParts)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage
    }
  });
}
