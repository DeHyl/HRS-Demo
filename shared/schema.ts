import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, date, json, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session table for connect-pg-simple (express-session with PostgreSQL)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Re-export chat schema for Gemini integration
export * from "./models/chat";

// User Roles for Role-Based Access Control
export const userRoleEnum = ["admin", "manager", "sdr", "account_specialist", "account_executive"] as const;
export type UserRole = typeof userRoleEnum[number];

// Users table with authentication and role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("sdr"),
  isActive: boolean("is_active").default(true).notNull(),
  sdrId: varchar("sdr_id", { length: 50 }),
  managerId: varchar("manager_id"),
  accountSpecialistId: varchar("account_specialist_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true, 
  lastLoginAt: true,
  isActive: true,
}).extend({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(userRoleEnum).default("sdr"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Manager Directory - Sales Managers
export const managers = pgTable("managers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  title: text("title").default("Sales Manager"),
  bio: text("bio"),
  coachingStyle: text("coaching_style"),
  specialties: text("specialties"),
  yearsExperience: integer("years_experience"),
  certifications: text("certifications"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertManagerSchema = createInsertSchema(managers).omit({ id: true, createdAt: true });
export type InsertManager = z.infer<typeof insertManagerSchema>;
export type Manager = typeof managers.$inferSelect;

// SDR Directory - Sales Development Representatives
export const sdrs = pgTable("sdrs", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  managerEmail: text("manager_email").notNull(),
  managerId: varchar("manager_id").references(() => managers.id),
  gender: text("gender").default("neutral").notNull(),
  timezone: text("timezone"),
  phone: text("phone"),
  title: text("title").default("Sales Development Representative"),
  bio: text("bio"),
  strengths: text("strengths"),
  developmentAreas: text("development_areas"),
  goals: text("goals"),
  startDate: date("start_date"),
  yearsExperience: integer("years_experience"),
  previousCompany: text("previous_company"),
  specialties: text("specialties"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSdrSchema = createInsertSchema(sdrs).omit({ createdAt: true }).extend({
  timezone: z.string().nullable().optional()
});
export type InsertSdr = z.infer<typeof insertSdrSchema>;
export type Sdr = typeof sdrs.$inferSelect;

// Account Executives Directory
export const accountExecutives = pgTable("account_executives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  region: text("region"),
  specialty: text("specialty"),
  title: text("title").default("Account Executive"),
  bio: text("bio"),
  dealFocus: text("deal_focus"),
  yearsExperience: integer("years_experience"),
  quotaAttainment: integer("quota_attainment"),
  avgDealSize: integer("avg_deal_size"),
  profileImageUrl: text("profile_image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountExecutiveSchema = createInsertSchema(accountExecutives).omit({ id: true, createdAt: true });
export type InsertAccountExecutive = z.infer<typeof insertAccountExecutiveSchema>;
export type AccountExecutive = typeof accountExecutives.$inferSelect;

// Navigation Settings - Toggle and order navigation tabs
export const navigationSettings = pgTable("navigation_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  navKey: text("nav_key").notNull().unique(),
  label: text("label").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNavigationSettingSchema = createInsertSchema(navigationSettings).omit({ id: true, updatedAt: true });
export type InsertNavigationSetting = z.infer<typeof insertNavigationSettingSchema>;
export type NavigationSetting = typeof navigationSettings.$inferSelect;

// Lead Status enum for tracking pipeline progression
export const leadStatusEnum = ["new", "researching", "contacted", "engaged", "qualified", "handed_off", "converted", "lost"] as const;
export type LeadStatus = typeof leadStatusEnum[number];

// Leads table for sales prospects
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  companyWebsite: text("company_website"),
  companyIndustry: text("company_industry"),
  companySize: text("company_size"),
  contactName: text("contact_name").notNull(),
  contactTitle: text("contact_title"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  contactLinkedIn: text("contact_linkedin"),
  source: text("source").default("manual").notNull(),
  status: text("status").default("new").notNull(),
  fitScore: integer("fit_score"),
  priority: text("priority"),
  assignedSdrId: varchar("assigned_sdr_id", { length: 50 }).references(() => sdrs.id),
  assignedAeId: varchar("assigned_ae_id"),
  qualificationNotes: text("qualification_notes"),
  buySignals: text("buy_signals"),
  budget: text("budget"),
  timeline: text("timeline"),
  decisionMakers: text("decision_makers"),
  handedOffAt: timestamp("handed_off_at"),
  handedOffBy: varchar("handed_off_by"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  lastContactedAt: timestamp("last_contacted_at"),
  salesforceId: varchar("salesforce_id"),
  salesforceLastSync: timestamp("salesforce_last_sync"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Lifecycle timestamps for baseline metrics tracking
  firstContactedAt: timestamp("first_contacted_at"),
  qualifiedAt: timestamp("qualified_at"),
  convertedAt: timestamp("converted_at"),
  lostAt: timestamp("lost_at"),
  // Scrubbing Agent fields
  companyDescription: text("company_description"),
  disqualificationReason: text("disqualification_reason"),
  researchStatus: text("research_status"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

// Live Coaching Sessions - Track calls
export const liveCoachingSessions = pgTable("live_coaching_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callProvider: text("call_provider").default("twilio").notNull(),
  zoomMeetingId: text("zoom_meeting_id").notNull(),
  zoomMeetingUuid: text("zoom_meeting_uuid"),
  sdrId: varchar("sdr_id", { length: 50 }).references(() => sdrs.id),
  leadId: varchar("lead_id").references(() => leads.id),
  hostEmail: text("host_email"),
  topic: text("topic"),
  status: text("status").notNull().default("active"),
  streamId: text("stream_id"),
  leadContext: text("lead_context"),
  joinUrl: text("join_url"),
  phoneNumber: text("phone_number"),
  callDuration: integer("call_duration"),
  callOutcome: text("call_outcome"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const insertLiveCoachingSessionSchema = createInsertSchema(liveCoachingSessions).omit({ 
  id: true, 
  startedAt: true,
  endedAt: true
});
export type InsertLiveCoachingSession = z.infer<typeof insertLiveCoachingSessionSchema>;
export type LiveCoachingSession = typeof liveCoachingSessions.$inferSelect;

// Live Coaching Tips - Real-time AI coaching tips during calls
export const liveCoachingTips = pgTable("live_coaching_tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => liveCoachingSessions.id).notNull(),
  tipType: text("tip_type").notNull(),
  content: text("content").notNull(),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLiveCoachingTipSchema = createInsertSchema(liveCoachingTips).omit({ 
  id: true, 
  createdAt: true
});
export type InsertLiveCoachingTip = z.infer<typeof insertLiveCoachingTipSchema>;
export type LiveCoachingTip = typeof liveCoachingTips.$inferSelect;

// Live Transcripts - Store live transcript chunks
export const liveTranscripts = pgTable("live_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => liveCoachingSessions.id).notNull(),
  speaker: text("speaker"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertLiveTranscriptSchema = createInsertSchema(liveTranscripts).omit({ 
  id: true
});
export type InsertLiveTranscript = z.infer<typeof insertLiveTranscriptSchema>;
export type LiveTranscript = typeof liveTranscripts.$inferSelect;

// Research Packets - AI-generated lead intelligence
export const researchPackets = pgTable("research_packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  companyIntel: text("company_intel"),
  contactIntel: text("contact_intel"),
  painSignals: text("pain_signals"),
  competitorPresence: text("competitor_presence"),
  fitAnalysis: text("fit_analysis"),
  fitScore: integer("fit_score"),
  priority: text("priority"),
  talkTrack: text("talk_track"),
  discoveryQuestions: text("discovery_questions"),
  objectionHandles: text("objection_handles"),
  companyHardIntel: text("company_hard_intel"),
  xIntel: text("x_intel"),
  linkedInIntel: text("linkedin_intel"),
  sources: text("sources"),
  verificationStatus: text("verification_status").default("unverified"),
  painPointsJson: jsonb("pain_points_json"),
  productMatchesJson: jsonb("product_matches_json"),
  linkedInProfileJson: jsonb("linkedin_profile_json"),
  xIntelJson: jsonb("x_intel_json"),
  careerHistoryJson: jsonb("career_history_json"),
  dossierJson: jsonb("dossier_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertResearchPacketSchema = createInsertSchema(researchPackets).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertResearchPacket = z.infer<typeof insertResearchPacketSchema>;
export type ResearchPacket = typeof researchPackets.$inferSelect;

// Sessions table for express-session
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Twilio Call Sessions - Track browser-based calls
export const callSessions = pgTable("call_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callSid: text("call_sid").unique(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  leadId: varchar("lead_id").references(() => leads.id),
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  status: text("status").notNull().default("initiated"), // initiated, ringing, in-progress, completed, failed, busy, no-answer
  duration: integer("duration"),
  recordingUrl: text("recording_url"),
  driveFileId: text("drive_file_id"),
  transcriptText: text("transcript_text"),
  coachingNotes: text("coaching_notes"),
  managerSummary: text("manager_summary"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  disposition: text("disposition"), // connected, voicemail, no-answer, busy, callback-scheduled, not-interested, qualified, meeting-booked
  keyTakeaways: text("key_takeaways"),
  nextSteps: text("next_steps"),
  sdrNotes: text("sdr_notes"),
  callbackDate: timestamp("callback_date"),
  sentimentScore: integer("sentiment_score"), // 1-5 scale from AI analysis
});

export const insertCallSessionSchema = createInsertSchema(callSessions).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});
export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessions.$inferSelect;

// Manager Call Analyses - Detailed performance tracking for managers
export const managerCallAnalyses = pgTable("manager_call_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callSessionId: varchar("call_session_id").references(() => callSessions.id).notNull(),
  sdrId: text("sdr_id").notNull(),
  sdrName: text("sdr_name").notNull(),
  callDate: timestamp("call_date").notNull(),
  callType: text("call_type"),
  durationSeconds: integer("duration_seconds"),
  overallScore: integer("overall_score").notNull(),
  openingScore: integer("opening_score"),
  discoveryScore: integer("discovery_score"),
  listeningScore: integer("listening_score"),
  objectionScore: integer("objection_score"),
  valuePropositionScore: integer("value_proposition_score"),
  closingScore: integer("closing_score"),
  complianceScore: integer("compliance_score"),
  keyObservations: text("key_observations"),
  criteriaComparison: text("criteria_comparison"),
  recommendations: text("recommendations"),
  managerNotes: text("manager_notes"),
  summary: text("summary"),
  fullAnalysis: text("full_analysis"),
  transcript: text("transcript"),
  emailSentTo: text("email_sent_to"),
  emailSentAt: timestamp("email_sent_at"),
  evaluationDocId: text("evaluation_doc_id"),
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  analyzedBy: text("analyzed_by"),
});

export const insertManagerCallAnalysisSchema = createInsertSchema(managerCallAnalyses).omit({
  id: true,
  analyzedAt: true,
});
export type InsertManagerCallAnalysis = z.infer<typeof insertManagerCallAnalysisSchema>;
export type ManagerCallAnalysis = typeof managerCallAnalyses.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  sdr: one(sdrs, {
    fields: [users.sdrId],
    references: [sdrs.id],
  }),
  manager: one(managers, {
    fields: [users.managerId],
    references: [managers.id],
  }),
}));

export const managersRelations = relations(managers, ({ many }) => ({
  sdrs: many(sdrs),
}));

export const sdrsRelations = relations(sdrs, ({ one, many }) => ({
  manager: one(managers, {
    fields: [sdrs.managerId],
    references: [managers.id],
  }),
  leads: many(leads),
  sessions: many(liveCoachingSessions),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedSdr: one(sdrs, {
    fields: [leads.assignedSdrId],
    references: [sdrs.id],
  }),
  researchPackets: many(researchPackets),
  coachingSessions: many(liveCoachingSessions),
}));

export const liveCoachingSessionsRelations = relations(liveCoachingSessions, ({ one, many }) => ({
  sdr: one(sdrs, {
    fields: [liveCoachingSessions.sdrId],
    references: [sdrs.id],
  }),
  lead: one(leads, {
    fields: [liveCoachingSessions.leadId],
    references: [leads.id],
  }),
  tips: many(liveCoachingTips),
  transcripts: many(liveTranscripts),
}));

export const liveCoachingTipsRelations = relations(liveCoachingTips, ({ one }) => ({
  session: one(liveCoachingSessions, {
    fields: [liveCoachingTips.sessionId],
    references: [liveCoachingSessions.id],
  }),
}));

export const liveTranscriptsRelations = relations(liveTranscripts, ({ one }) => ({
  session: one(liveCoachingSessions, {
    fields: [liveTranscripts.sessionId],
    references: [liveCoachingSessions.id],
  }),
}));

export const researchPacketsRelations = relations(researchPackets, ({ one }) => ({
  lead: one(leads, {
    fields: [researchPackets.leadId],
    references: [leads.id],
  }),
}));

// Notification types for system notifications
export const notificationTypeEnum = [
  "lead_status_change",
  "lead_qualified",
  "lead_assigned",
  "call_completed",
  "call_analyzed",
  "meeting_booked",
  "research_ready",
  "coaching_available",
  "ae_handoff"
] as const;
export type NotificationType = typeof notificationTypeEnum[number];

// Notifications table for user alerts
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ 
  id: true, 
  createdAt: true,
  isRead: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Integration Settings - Store OAuth tokens and settings for external integrations
export const integrationProviderEnum = ["salesforce", "hubspot", "pipedrive"] as const;
export type IntegrationProvider = typeof integrationProviderEnum[number];

export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().unique(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  instanceUrl: text("instance_url"),
  expiresAt: timestamp("expires_at"),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  syncConfig: jsonb("sync_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIntegrationSettingSchema = createInsertSchema(integrationSettings).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});
export type InsertIntegrationSetting = z.infer<typeof insertIntegrationSettingSchema>;
export type IntegrationSetting = typeof integrationSettings.$inferSelect;

// Salesforce Sync Log - Track sync operations
export const salesforceSyncLog = pgTable("salesforce_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operation: text("operation").notNull(),
  direction: text("direction").notNull(),
  recordCount: integer("record_count").default(0),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertSalesforceSyncLogSchema = createInsertSchema(salesforceSyncLog).omit({
  id: true,
  startedAt: true,
});
export type InsertSalesforceSyncLog = z.infer<typeof insertSalesforceSyncLogSchema>;
export type SalesforceSyncLog = typeof salesforceSyncLog.$inferSelect;

// Baseline Metrics Snapshots - Capture point-in-time metrics for before/after comparison
export const baselineSnapshots = pgTable("baseline_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotType: text("snapshot_type").notNull(), // 'baseline', 'phase1_launch', 'phase1_30day', 'phase2_launch', etc.
  snapshotLabel: text("snapshot_label").notNull(), // Human-readable description

  // Lead Processing Time Metrics (in hours)
  avgTimeToFirstContact: integer("avg_time_to_first_contact"), // Hours from intake to first contact
  avgTimeToQualification: integer("avg_time_to_qualification"), // Hours from intake to qualification
  avgTimeToHandoff: integer("avg_time_to_handoff"), // Hours from intake to AE handoff
  avgTimeQualToHandoff: integer("avg_time_qual_to_handoff"), // Hours from qualification to handoff

  // Volume & Capacity Metrics
  totalLeadsProcessed: integer("total_leads_processed"),
  leadsPerSdrPerDay: integer("leads_per_sdr_per_day"), // Average leads handled per SDR per day
  callsPerSdrPerDay: integer("calls_per_sdr_per_day"), // Average calls per SDR per day
  maxCallsPerSdrPerDay: integer("max_calls_per_sdr_per_day"), // Peak calls per SDR per day
  activeSdrCount: integer("active_sdr_count"),

  // Lead Quality Metrics
  avgFitScore: integer("avg_fit_score"), // Average AI fit score (0-100)
  qualifiedLeadAccuracy: integer("qualified_lead_accuracy"), // % of "qualified" leads that converted
  qualifiedLeadsCount: integer("qualified_leads_count"),
  convertedLeadsCount: integer("converted_leads_count"),
  lostLeadsCount: integer("lost_leads_count"),

  // Conversion Metrics
  leadToQualifiedRate: integer("lead_to_qualified_rate"), // % of leads that reach qualified
  qualifiedToConvertedRate: integer("qualified_to_converted_rate"), // % of qualified that convert
  overallConversionRate: integer("overall_conversion_rate"), // % intake to converted

  // Call Effectiveness Metrics
  avgCallScore: integer("avg_call_score"), // Average 7-dimension call score
  avgOpeningScore: integer("avg_opening_score"),
  avgDiscoveryScore: integer("avg_discovery_score"),
  avgListeningScore: integer("avg_listening_score"),
  avgObjectionScore: integer("avg_objection_score"),
  avgValuePropScore: integer("avg_value_prop_score"),
  avgClosingScore: integer("avg_closing_score"),
  totalCallsAnalyzed: integer("total_calls_analyzed"),

  // Sales Cycle Metrics (in days)
  avgSalesCycleDays: integer("avg_sales_cycle_days"), // Days from intake to converted
  medianSalesCycleDays: integer("median_sales_cycle_days"),

  // Adoption Metrics
  dailyActiveUsers: integer("daily_active_users"),
  weeklyActiveUsers: integer("weekly_active_users"),
  monthlyActiveUsers: integer("monthly_active_users"),
  avgLoginsPerUserPerWeek: integer("avg_logins_per_user_per_week"),

  // Research Utilization Metrics
  leadsWithResearch: integer("leads_with_research"),
  avgResearchGenerationTime: integer("avg_research_generation_time"), // Minutes to generate research
  researchUtilizationRate: integer("research_utilization_rate"), // % of calls that used research

  // Pipeline Metrics
  totalPipelineValue: integer("total_pipeline_value"), // Total $ value of qualified leads
  avgDealValue: integer("avg_deal_value"),

  // Raw data for detailed analysis
  rawMetricsJson: jsonb("raw_metrics_json"), // Full detailed metrics snapshot

  // Metadata
  periodStartDate: timestamp("period_start_date").notNull(), // Start of measurement period
  periodEndDate: timestamp("period_end_date").notNull(), // End of measurement period
  capturedBy: varchar("captured_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBaselineSnapshotSchema = createInsertSchema(baselineSnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertBaselineSnapshot = z.infer<typeof insertBaselineSnapshotSchema>;
export type BaselineSnapshot = typeof baselineSnapshots.$inferSelect;

// Lead Status History - Track status transitions for velocity metrics
export const leadStatusHistory = pgTable("lead_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: varchar("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  durationInPreviousStatus: integer("duration_in_previous_status"), // Minutes in previous status
});

export const insertLeadStatusHistorySchema = createInsertSchema(leadStatusHistory).omit({
  id: true,
  changedAt: true,
});
export type InsertLeadStatusHistory = z.infer<typeof insertLeadStatusHistorySchema>;
export type LeadStatusHistory = typeof leadStatusHistory.$inferSelect;

export const leadStatusHistoryRelations = relations(leadStatusHistory, ({ one }) => ({
  lead: one(leads, {
    fields: [leadStatusHistory.leadId],
    references: [leads.id],
  }),
  changedByUser: one(users, {
    fields: [leadStatusHistory.changedBy],
    references: [users.id],
  }),
}));

// ─── Lead Response Engine ─────────────────────────────────────────────────────
export const leadResponseLog = pgTable("lead_response_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  leadEmail: text("lead_email").notNull(),
  leadName: text("lead_name"),
  company: text("company"),
  industry: text("industry"),
  title: text("title"),
  leadSource: text("lead_source"),
  emailSubject: text("email_subject").notNull(),
  emailBody: text("email_body").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  status: text("status").notNull().default("sent"),
  qualScore: integer("qual_score"),
  qualReason: text("qual_reason"),
  processingMs: integer("processing_ms"),
});

export const insertLeadResponseLogSchema = createInsertSchema(leadResponseLog).omit({ id: true, sentAt: true });
export type InsertLeadResponseLog = z.infer<typeof insertLeadResponseLogSchema>;
export type LeadResponseLog = typeof leadResponseLog.$inferSelect;

// ─── Gmail Watcher — Processed Messages Log ───────────────────────────────────
export const gmailProcessedMessages = pgTable("gmail_processed_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().unique(), // Gmail message ID
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  subject: text("subject"),
  leadId: varchar("lead_id"),
  replyBody: text("reply_body"), // What Robin actually sent
  threadId: varchar("thread_id"), // Gmail thread ID (for grouping)
  paused: boolean("paused").default(false), // true = human took over, AI stops responding
  pausedBy: varchar("paused_by"), // userId who took over
  pausedAt: timestamp("paused_at"),
  autoReplied: boolean("auto_replied").default(false),
  escalated: boolean("escalated").default(false),
  engagementScore: integer("engagement_score"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const insertGmailProcessedMessageSchema = createInsertSchema(gmailProcessedMessages).omit({
  id: true,
  processedAt: true,
});
export type InsertGmailProcessedMessage = z.infer<typeof insertGmailProcessedMessageSchema>;

export type GmailProcessedMessage = typeof gmailProcessedMessages.$inferSelect;
