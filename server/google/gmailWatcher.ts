/**
 * gmailWatcher.ts
 * Polls hawk.gametime@gmail.com every 60 seconds for new inbound emails.
 * When a new email arrives from a prospect:
 *   1. Runs it through the Inbound Email Agent (analyzeInboundEmail)
 *   2. Auto-creates the lead if new
 *   3. Sends the AI-drafted reply immediately
 *
 * Uses Gmail history API to only fetch new messages since last check.
 * Tracks processed message IDs in memory + DB to prevent duplicates.
 */

import { google } from "googleapis";
import { analyzeInboundEmail } from "../ai/inboundEmailAgent.js";
import { sendFeedbackEmail } from "./gmailClient.js";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { gmailProcessedMessages } from "@shared/schema";
import { and, eq } from "drizzle-orm";

// ─── Config ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const HAWK_EMAIL = "hawk.gametime@gmail.com";

// In-memory cache to avoid hitting DB on every poll
const processedMessageIds = new Set<string>();

let pollTimer: NodeJS.Timeout | null = null;
let lastHistoryId: string | null = null;
let isRunning = false;

// ─── Gmail client ─────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getGmail() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

// ─── Email parsing helpers ────────────────────────────────────────────────────

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: any): string {
  if (!payload) return "";

  // Direct body
  if (payload.body?.data) return decodeBase64(payload.body.data);

  // Multipart — prefer text/plain, fallback to text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    const part = textPart || htmlPart;
    if (part?.body?.data) return decodeBase64(part.body.data);

    // Nested multipart
    for (const p of payload.parts) {
      const nested = extractBody(p);
      if (nested) return nested;
    }
  }

  return "";
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function stripReplyQuotes(body: string): string {
  // Remove everything after common reply separators
  const separators = [
    /\nOn .+ wrote:\n/,
    /\n-{3,}\nFrom:/,
    /\n_{3,}\n/,
    /\n>{3}.+/,
  ];
  for (const sep of separators) {
    const idx = body.search(sep);
    if (idx > 100) return body.slice(0, idx).trim();
  }
  return body.trim();
}

// ─── Core poll logic ──────────────────────────────────────────────────────────

async function fetchNewMessages(gmail: any): Promise<string[]> {
  try {
    if (lastHistoryId) {
      // Efficient: only fetch changes since last historyId
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });

      const history = historyRes.data.history || [];
      if (historyRes.data.historyId) lastHistoryId = historyRes.data.historyId;

      const ids: string[] = [];
      for (const record of history) {
        for (const msg of record.messagesAdded || []) {
          ids.push(msg.message.id);
        }
      }
      return ids;
    } else {
      // First run: get last 10 messages to initialize, don't process them
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10,
        labelIds: ["INBOX"],
        q: "is:unread",
      });

      const messages = listRes.data.messages || [];

      // Get current historyId from profile
      const profile = await gmail.users.getProfile({ userId: "me" });
      lastHistoryId = profile.data.historyId;

      // Mark all existing as processed so we don't re-trigger them
      for (const msg of messages) {
        processedMessageIds.add(msg.id);
      }

      console.log(`[GmailWatcher] Initialized — historyId: ${lastHistoryId}, skipped ${messages.length} existing messages`);
      return []; // Don't process existing messages
    }
  } catch (err: any) {
    // historyId too old — reset
    if (err?.code === 404 || err?.status === 404) {
      console.warn("[GmailWatcher] History expired, resetting");
      lastHistoryId = null;
    } else {
      throw err;
    }
    return [];
  }
}

async function processMessage(gmail: any, messageId: string): Promise<void> {
  if (processedMessageIds.has(messageId)) return;
  processedMessageIds.add(messageId);

  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = msgRes.data;
  const headers = msg.payload?.headers || [];

  const from = getHeader(headers, "from");
  const subject = getHeader(headers, "subject");
  const labelIds: string[] = msg.labelIds || [];

  // Skip emails we sent, automated/noreply, or not in INBOX
  if (!labelIds.includes("INBOX")) return;
  if (from.includes(HAWK_EMAIL)) return;
  if (from.toLowerCase().includes("noreply") || from.toLowerCase().includes("no-reply")) return;
  if (subject.toLowerCase().includes("unsubscribe")) return;

  const rawBody = extractBody(msg.payload);
  const body = stripReplyQuotes(rawBody);

  if (!body || body.length < 20) {
    console.log(`[GmailWatcher] Skipping short/empty email from ${from}`);
    return;
  }

  // Check if this lead's thread is paused (human took over)
  const existing = await db.select().from(gmailProcessedMessages)
    .where(eq(gmailProcessedMessages.messageId, messageId)).limit(1);
  if (existing[0]?.paused) return;

  // Also check if any message in this thread is paused
  if (msg.threadId) {
    const pausedThread = await db.select().from(gmailProcessedMessages)
      .where(and(eq(gmailProcessedMessages.threadId, msg.threadId), eq(gmailProcessedMessages.paused, true)))
      .limit(1);
    if (pausedThread.length > 0) {
      console.log(`[GmailWatcher] Thread ${msg.threadId} is paused — skipping`);
      return;
    }
  }

  console.log(`[GmailWatcher] 📨 New email from ${from} — "${subject}"`);

  try {
    // Run through Inbound Email Agent
    const analysis = await analyzeInboundEmail({ from, subject, body });

    if (!analysis.senderEmail) {
      console.log(`[GmailWatcher] Couldn't extract email from "${from}", skipping`);
      return;
    }

    // Deduplicate lead by email
    let lead = await storage.getLeadByEmail(analysis.senderEmail);
    let isNewLead = false;

    if (!lead) {
      const priority =
        analysis.engagementScore >= 4 ? "hot" :
        analysis.engagementScore >= 3 ? "warm" :
        analysis.engagementScore >= 2 ? "cool" : "cold";

      lead = await storage.createLead({
        companyName: analysis.senderCompany || analysis.senderDomain || "Unknown",
        contactName: analysis.senderName || analysis.senderEmail,
        contactEmail: analysis.senderEmail,
        companyWebsite: analysis.senderDomain ? `https://${analysis.senderDomain}` : undefined,
        source: "inbound_email",
        status: "new",
        fitScore: Math.round(analysis.engagementScore * 20),
        priority,
        notes: `[Auto] Inbound email: ${subject}`,
      });
      isNewLead = true;
    }

    let autoReplied = false;

    // Send AI-drafted reply
    if (analysis.suggestedResponse && !analysis.escalateToHuman) {
      await sendFeedbackEmail({
        to: analysis.senderEmail,
        subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
        body: analysis.suggestedResponse.replace(/\n/g, "<br>"),
      });
      autoReplied = true;
      console.log(`[GmailWatcher] ✅ Auto-replied to ${analysis.senderEmail} (lead ${isNewLead ? "created" : "existing"})`);
    } else if (analysis.escalateToHuman) {
      console.log(`[GmailWatcher] 🚨 Escalating to human: ${analysis.escalationReason}`);
    }

    // Log in DB
    try {
      await db.insert(gmailProcessedMessages).values({
        messageId,
        fromEmail: analysis.senderEmail,
        fromName: analysis.senderName,
        subject,
        leadId: lead?.id || null,
        replyBody: autoReplied ? analysis.suggestedResponse : null,
        threadId: msg.threadId || null,
        autoReplied,
        escalated: analysis.escalateToHuman,
        engagementScore: analysis.engagementScore,
      });
    } catch (_) {
      // Non-fatal — in-memory set already prevents duplicates
    }

  } catch (err) {
    console.error(`[GmailWatcher] Error processing message ${messageId}:`, err instanceof Error ? err.message : err);
  }
}

async function poll(): Promise<void> {
  if (!isConfigured()) return;

  try {
    const gmail = getGmail();
    const newMessageIds = await fetchNewMessages(gmail);

    for (const id of newMessageIds) {
      await processMessage(gmail, id);
    }
  } catch (err) {
    console.error("[GmailWatcher] Poll error:", err instanceof Error ? err.message : err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startGmailWatcher(): void {
  if (isRunning) return;

  if (!isConfigured()) {
    console.warn("[GmailWatcher] Google OAuth not configured — watcher disabled");
    return;
  }

  isRunning = true;
  console.log(`[GmailWatcher] 🚀 Started — polling ${HAWK_EMAIL} every ${POLL_INTERVAL_MS / 1000}s`);

  // Initial poll (sets up historyId, doesn't process existing emails)
  poll();

  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopGmailWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  lastHistoryId = null;
  console.log("[GmailWatcher] Stopped");
}

export function getWatcherStatus(): { running: boolean; lastHistoryId: string | null; processedCount: number } {
  return {
    running: isRunning,
    lastHistoryId,
    processedCount: processedMessageIds.size,
  };
}
