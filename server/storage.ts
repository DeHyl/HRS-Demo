import { 
  type User, type InsertUser,
  type Manager, type InsertManager,
  type Sdr, type InsertSdr,
  type Lead, type InsertLead,
  type LiveCoachingSession, type InsertLiveCoachingSession,
  type LiveCoachingTip, type InsertLiveCoachingTip,
  type LiveTranscript, type InsertLiveTranscript,
  type ResearchPacket, type InsertResearchPacket,
  type CallSession, type InsertCallSession,
  type ManagerCallAnalysis, type InsertManagerCallAnalysis,
  type AccountExecutive, type InsertAccountExecutive,
  type Notification, type InsertNotification,
  type NavigationSetting,
  type PasswordResetToken,
  type RobinConfig, type InsertRobinConfig,
  type AeTerritoryRouting, type InsertAeTerritoryRouting,
  users, managers, sdrs, leads, 
  liveCoachingSessions, liveCoachingTips, liveTranscripts, researchPackets,
  callSessions, managerCallAnalyses, accountExecutives, notifications, navigationSettings,
  passwordResetTokens,
  robinConfig, aeTerritoryRouting
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, isNotNull, desc, inArray, sql, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  updateUserProfile(id: string, updates: { name?: string; email?: string }): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  getManager(id: string): Promise<Manager | undefined>;
  getAllManagers(): Promise<Manager[]>;
  createManager(manager: InsertManager): Promise<Manager>;
  
  getSdr(id: string): Promise<Sdr | undefined>;
  getAllSdrs(): Promise<Sdr[]>;
  getSdrsByManager(managerId: string): Promise<Sdr[]>;
  createSdr(sdr: InsertSdr): Promise<Sdr>;
  updateSdr(id: string, updates: Partial<InsertSdr>): Promise<Sdr | undefined>;
  deleteSdr(id: string): Promise<boolean>;
  getUsersBySdrIds(sdrIds: string[]): Promise<User[]>;
  getUserBySdrId(sdrId: string): Promise<User | undefined>;

  getAccountExecutive(id: string): Promise<AccountExecutive | undefined>;
  getAllAccountExecutives(): Promise<AccountExecutive[]>;
  createAccountExecutive(ae: InsertAccountExecutive): Promise<AccountExecutive>;
  updateAccountExecutive(id: string, updates: Partial<InsertAccountExecutive>): Promise<AccountExecutive | undefined>;
  deleteAccountExecutive(id: string): Promise<boolean>;
  
  getLead(id: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  getAllLeads(): Promise<Lead[]>;
  getAllLeadsWithResearch(): Promise<Array<Lead & { hasResearch: boolean; researchStatus: string | null }>>;
  getLeadsBySdr(sdrId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  createLeads(leadsData: InsertLead[]): Promise<Lead[]>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  
  getLiveCoachingSession(id: string): Promise<LiveCoachingSession | undefined>;
  getActiveSessionBySdr(sdrId: string): Promise<LiveCoachingSession | undefined>;
  getLiveCoachingSessionsByLead(leadId: string): Promise<LiveCoachingSession[]>;
  getAllLiveCoachingSessions(): Promise<LiveCoachingSession[]>;
  createLiveCoachingSession(session: InsertLiveCoachingSession): Promise<LiveCoachingSession>;
  updateLiveCoachingSession(id: string, session: Partial<InsertLiveCoachingSession>): Promise<LiveCoachingSession | undefined>;
  
  getLiveCoachingTipsBySession(sessionId: string): Promise<LiveCoachingTip[]>;
  createLiveCoachingTip(tip: InsertLiveCoachingTip): Promise<LiveCoachingTip>;
  
  getLiveTranscriptsBySession(sessionId: string): Promise<LiveTranscript[]>;
  createLiveTranscript(transcript: InsertLiveTranscript): Promise<LiveTranscript>;
  
  getResearchPacketByLead(leadId: string): Promise<ResearchPacket | undefined>;
  getAllResearchPackets(): Promise<ResearchPacket[]>;
  createResearchPacket(packet: InsertResearchPacket): Promise<ResearchPacket>;
  updateResearchPacket(id: string, packet: Partial<InsertResearchPacket>): Promise<ResearchPacket | undefined>;
  deleteResearchPacket(id: string): Promise<boolean>;
  
  getCallSession(id: string): Promise<CallSession | undefined>;
  getCallSessionByCallSid(callSid: string): Promise<CallSession | undefined>;
  getCallSessionByZoomId(zoomCallId: string): Promise<CallSession | undefined>;
  getCallSessionsByUser(userId: string): Promise<CallSession[]>;
  getCallSessionsByLead(leadId: string): Promise<CallSession[]>;
  getAllCallSessions(): Promise<CallSession[]>;
  getCallSessionsByUserIds(userIds: string[]): Promise<CallSession[]>;
  getCoachingTipsCountBySession(sessionIds: string[]): Promise<Map<string, number>>;
  getAllCoachingTips(): Promise<{ tipType: string; count: number }[]>;
  getRecentCoachingTips(limit?: number): Promise<{ sessionId: string; tipType: string; content: string; createdAt: Date }[]>;
  getRecentInitiatedCallSession(toNumber: string): Promise<CallSession | undefined>;
  createCallSession(session: InsertCallSession): Promise<CallSession>;
  updateCallSession(id: string, updates: Partial<InsertCallSession>): Promise<CallSession | undefined>;
  updateCallSessionByCallSid(callSid: string, updates: Partial<InsertCallSession>): Promise<CallSession | undefined>;
  
  createManagerCallAnalysis(analysis: InsertManagerCallAnalysis): Promise<ManagerCallAnalysis>;
  getManagerCallAnalysis(id: string): Promise<ManagerCallAnalysis | undefined>;
  getManagerCallAnalysisByCallSession(callSessionId: string): Promise<ManagerCallAnalysis | undefined>;
  getManagerCallAnalysesBySdr(sdrId: string): Promise<ManagerCallAnalysis[]>;
  getManagerAnalysesByUser(userId: string): Promise<ManagerCallAnalysis[]>;
  getAllManagerCallAnalyses(): Promise<ManagerCallAnalysis[]>;
  getCoachingTipsByUser(userId: string): Promise<LiveCoachingTip[]>;
  
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string): Promise<boolean>;
  
  getAllNavigationSettings(): Promise<NavigationSetting[]>;
  updateNavigationSetting(id: string, updates: { isEnabled?: boolean; sortOrder?: number }): Promise<NavigationSetting | undefined>;
  initializeNavigationSettings(): Promise<void>;
  
  // Lead transcript search for Copilot
  searchLeadsByName(searchName: string): Promise<Lead[]>;
  getCallsWithTranscriptsByLead(leadId: string): Promise<Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>>;
  
  // SDR call search for Copilot
  searchSdrsByName(searchName: string): Promise<Array<{ sdr: Sdr; user: User }>>;
  getCallsWithTranscriptsByUser(userId: string, limit?: number): Promise<Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>>;
  
  // Password Reset Tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async updateUserProfile(id: string, updates: { name?: string; email?: string }): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id));
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getManager(id: string): Promise<Manager | undefined> {
    const [manager] = await db.select().from(managers).where(eq(managers.id, id));
    return manager;
  }

  async createManager(insertManager: InsertManager): Promise<Manager> {
    const [manager] = await db.insert(managers).values(insertManager).returning();
    return manager;
  }

  async getAllManagers(): Promise<Manager[]> {
    return db.select().from(managers).orderBy(managers.name);
  }

  async getSdr(id: string): Promise<Sdr | undefined> {
    const [sdr] = await db.select().from(sdrs).where(eq(sdrs.id, id));
    return sdr;
  }

  async getAllSdrs(): Promise<Sdr[]> {
    return db.select().from(sdrs).orderBy(sdrs.name);
  }

  async getSdrsByManager(managerId: string): Promise<Sdr[]> {
    return db.select().from(sdrs).where(eq(sdrs.managerId, managerId)).orderBy(sdrs.name);
  }

  async getUsersBySdrIds(sdrIds: string[]): Promise<User[]> {
    if (sdrIds.length === 0) return [];
    return db.select().from(users).where(inArray(users.sdrId, sdrIds));
  }

  async getUserBySdrId(sdrId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.sdrId, sdrId));
    return user;
  }

  async createSdr(insertSdr: InsertSdr): Promise<Sdr> {
    const [sdr] = await db.insert(sdrs).values(insertSdr).returning();
    return sdr;
  }

  async updateSdr(id: string, updates: Partial<InsertSdr>): Promise<Sdr | undefined> {
    const [sdr] = await db.update(sdrs).set(updates).where(eq(sdrs.id, id)).returning();
    return sdr;
  }

  async deleteSdr(id: string): Promise<boolean> {
    await db.delete(sdrs).where(eq(sdrs.id, id));
    return true;
  }

  async getAccountExecutive(id: string): Promise<AccountExecutive | undefined> {
    const [ae] = await db.select().from(accountExecutives).where(eq(accountExecutives.id, id));
    return ae;
  }

  async getAllAccountExecutives(): Promise<AccountExecutive[]> {
    return await db.select().from(accountExecutives).where(eq(accountExecutives.isActive, true));
  }

  async createAccountExecutive(ae: InsertAccountExecutive): Promise<AccountExecutive> {
    const [created] = await db.insert(accountExecutives).values(ae).returning();
    return created;
  }

  async updateAccountExecutive(id: string, updates: Partial<InsertAccountExecutive>): Promise<AccountExecutive | undefined> {
    const [updated] = await db.update(accountExecutives).set(updates).where(eq(accountExecutives.id, id)).returning();
    return updated;
  }

  async deleteAccountExecutive(id: string): Promise<boolean> {
    await db.update(accountExecutives).set({ isActive: false }).where(eq(accountExecutives.id, id));
    return true;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.contactEmail, email));
    return lead;
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  /**
   * Optimized method to fetch all leads with research status in a single query
   * Eliminates N+1 query bottleneck (was 101 queries for 100 leads, now just 1!)
   */
  async getAllLeadsWithResearch(): Promise<Array<Lead & { hasResearch: boolean; researchStatus: string | null }>> {
    const results = await db
      .select({
        // All lead fields
        id: leads.id,
        createdAt: leads.createdAt,
        status: leads.status,
        companyName: leads.companyName,
        companyWebsite: leads.companyWebsite,
        companyIndustry: leads.companyIndustry,
        companySize: leads.companySize,
        contactName: leads.contactName,
        contactTitle: leads.contactTitle,
        contactEmail: leads.contactEmail,
        contactPhone: leads.contactPhone,
        contactLinkedIn: leads.contactLinkedIn,
        source: leads.source,
        fitScore: leads.fitScore,
        priority: leads.priority,
        assignedSdrId: leads.assignedSdrId,
        assignedAeId: leads.assignedAeId,
        qualificationNotes: leads.qualificationNotes,
        buySignals: leads.buySignals,
        budget: leads.budget,
        timeline: leads.timeline,
        decisionMakers: leads.decisionMakers,
        handedOffAt: leads.handedOffAt,
        handedOffBy: leads.handedOffBy,
        nextFollowUpAt: leads.nextFollowUpAt,
        firstContactedAt: leads.firstContactedAt,
        qualifiedAt: leads.qualifiedAt,
        convertedAt: leads.convertedAt,
        lostAt: leads.lostAt,
        lastContactedAt: leads.lastContactedAt,
        salesforceId: leads.salesforceId,
        salesforceLastSync: leads.salesforceLastSync,
        companyDescription: leads.companyDescription,
        disqualificationReason: leads.disqualificationReason,
        // Research status fields
        researchPacketId: researchPackets.id,
        verificationStatus: researchPackets.verificationStatus,
      })
      .from(leads)
      .leftJoin(researchPackets, eq(leads.id, researchPackets.leadId))
      .orderBy(desc(leads.createdAt));

    return results.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      status: row.status,
      companyName: row.companyName,
      companyWebsite: row.companyWebsite,
      companyIndustry: row.companyIndustry,
      companySize: row.companySize,
      contactName: row.contactName,
      contactTitle: row.contactTitle,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      contactLinkedIn: row.contactLinkedIn,
      source: row.source,
      fitScore: row.fitScore,
      priority: row.priority,
      assignedSdrId: row.assignedSdrId,
      assignedAeId: row.assignedAeId,
      qualificationNotes: row.qualificationNotes,
      buySignals: row.buySignals,
      budget: row.budget,
      timeline: row.timeline,
      decisionMakers: row.decisionMakers,
      handedOffAt: row.handedOffAt,
      handedOffBy: row.handedOffBy,
      nextFollowUpAt: row.nextFollowUpAt,
      firstContactedAt: row.firstContactedAt,
      qualifiedAt: row.qualifiedAt,
      convertedAt: row.convertedAt,
      lostAt: row.lostAt,
      lastContactedAt: row.lastContactedAt,
      salesforceId: row.salesforceId,
      salesforceLastSync: row.salesforceLastSync,
      companyDescription: row.companyDescription,
      disqualificationReason: row.disqualificationReason,
      hasResearch: row.researchPacketId !== null,
      researchStatus: row.verificationStatus,
    }));
  }

  async getLeadsBySdr(sdrId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.assignedSdrId, sdrId));
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async createLeads(leadsData: InsertLead[]): Promise<Lead[]> {
    if (leadsData.length === 0) return [];
    return db.insert(leads).values(leadsData).returning();
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [lead] = await db.update(leads).set(updates).where(eq(leads.id, id)).returning();
    return lead;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id));
    return true;
  }

  async getLiveCoachingSession(id: string): Promise<LiveCoachingSession | undefined> {
    const [session] = await db.select().from(liveCoachingSessions).where(eq(liveCoachingSessions.id, id));
    return session;
  }

  async getActiveSessionBySdr(sdrId: string): Promise<LiveCoachingSession | undefined> {
    const [session] = await db.select()
      .from(liveCoachingSessions)
      .where(eq(liveCoachingSessions.sdrId, sdrId));
    return session;
  }

  async getLiveCoachingSessionsByLead(leadId: string): Promise<LiveCoachingSession[]> {
    return db.select()
      .from(liveCoachingSessions)
      .where(eq(liveCoachingSessions.leadId, leadId))
      .orderBy(desc(liveCoachingSessions.startedAt));
  }

  async getAllLiveCoachingSessions(): Promise<LiveCoachingSession[]> {
    return db.select()
      .from(liveCoachingSessions)
      .orderBy(desc(liveCoachingSessions.startedAt));
  }

  async createLiveCoachingSession(insertSession: InsertLiveCoachingSession): Promise<LiveCoachingSession> {
    const [session] = await db.insert(liveCoachingSessions).values(insertSession).returning();
    return session;
  }

  async updateLiveCoachingSession(id: string, updates: Partial<InsertLiveCoachingSession>): Promise<LiveCoachingSession | undefined> {
    const [session] = await db.update(liveCoachingSessions).set(updates).where(eq(liveCoachingSessions.id, id)).returning();
    return session;
  }

  async getLiveCoachingTipsBySession(sessionId: string): Promise<LiveCoachingTip[]> {
    return db.select().from(liveCoachingTips).where(eq(liveCoachingTips.sessionId, sessionId));
  }

  async createLiveCoachingTip(insertTip: InsertLiveCoachingTip): Promise<LiveCoachingTip> {
    const [tip] = await db.insert(liveCoachingTips).values(insertTip).returning();
    return tip;
  }

  async getLiveTranscriptsBySession(sessionId: string): Promise<LiveTranscript[]> {
    return db.select().from(liveTranscripts).where(eq(liveTranscripts.sessionId, sessionId));
  }

  async createLiveTranscript(insertTranscript: InsertLiveTranscript): Promise<LiveTranscript> {
    const [transcript] = await db.insert(liveTranscripts).values(insertTranscript).returning();
    return transcript;
  }

  async getResearchPacketByLead(leadId: string): Promise<ResearchPacket | undefined> {
    const [packet] = await db.select().from(researchPackets).where(eq(researchPackets.leadId, leadId));
    return packet;
  }

  async getAllResearchPackets(): Promise<ResearchPacket[]> {
    return db.select()
      .from(researchPackets)
      .orderBy(desc(researchPackets.createdAt));
  }

  async createResearchPacket(insertPacket: InsertResearchPacket): Promise<ResearchPacket> {
    const [packet] = await db.insert(researchPackets).values(insertPacket).returning();
    return packet;
  }

  async updateResearchPacket(id: string, updates: Partial<InsertResearchPacket>): Promise<ResearchPacket | undefined> {
    const [packet] = await db.update(researchPackets).set(updates).where(eq(researchPackets.id, id)).returning();
    return packet;
  }

  async deleteResearchPacket(id: string): Promise<boolean> {
    const result = await db.delete(researchPackets).where(eq(researchPackets.id, id));
    return true;
  }

  async getCallSession(id: string): Promise<CallSession | undefined> {
    const [session] = await db.select().from(callSessions).where(eq(callSessions.id, id));
    return session;
  }

  async getCallSessionByCallSid(callSid: string): Promise<CallSession | undefined> {
    const [session] = await db.select().from(callSessions).where(eq(callSessions.callSid, callSid));
    return session;
  }

  async getCallSessionByZoomId(zoomCallId: string): Promise<CallSession | undefined> {
    const [session] = await db.select().from(callSessions).where(eq(callSessions.callSid, `zoom_${zoomCallId}`));
    return session;
  }

  async getCallSessionsByUser(userId: string): Promise<CallSession[]> {
    return db.select().from(callSessions).where(eq(callSessions.userId, userId)).orderBy(desc(callSessions.startedAt));
  }

  async getCallSessionsByLead(leadId: string): Promise<CallSession[]> {
    return db.select().from(callSessions).where(eq(callSessions.leadId, leadId)).orderBy(desc(callSessions.startedAt));
  }

  async getAllCallSessions(): Promise<CallSession[]> {
    return db.select().from(callSessions).orderBy(desc(callSessions.startedAt));
  }

  async getCallSessionsByUserIds(userIds: string[]): Promise<CallSession[]> {
    if (userIds.length === 0) return [];
    return db.select().from(callSessions).where(inArray(callSessions.userId, userIds)).orderBy(desc(callSessions.startedAt));
  }

  async getCoachingTipsCountBySession(sessionIds: string[]): Promise<Map<string, number>> {
    if (sessionIds.length === 0) return new Map();
    const counts = await db
      .select({ 
        sessionId: liveCoachingTips.sessionId, 
        count: sql<number>`count(*)::int` 
      })
      .from(liveCoachingTips)
      .where(inArray(liveCoachingTips.sessionId, sessionIds))
      .groupBy(liveCoachingTips.sessionId);
    return new Map(counts.map(c => [c.sessionId, c.count]));
  }

  async getAllCoachingTips(): Promise<{ tipType: string; count: number }[]> {
    const results = await db
      .select({ 
        tipType: liveCoachingTips.tipType, 
        count: sql<number>`count(*)::int` 
      })
      .from(liveCoachingTips)
      .groupBy(liveCoachingTips.tipType)
      .orderBy(sql`count(*) DESC`);
    return results;
  }

  async getRecentCoachingTips(limit: number = 50): Promise<{ sessionId: string; tipType: string; content: string; createdAt: Date }[]> {
    const results = await db
      .select({
        sessionId: liveCoachingTips.sessionId,
        tipType: liveCoachingTips.tipType,
        content: liveCoachingTips.content,
        createdAt: liveCoachingTips.createdAt,
      })
      .from(liveCoachingTips)
      .orderBy(desc(liveCoachingTips.createdAt))
      .limit(limit);
    return results;
  }

  async getRecentInitiatedCallSession(toNumber: string): Promise<CallSession | undefined> {
    const [session] = await db.select()
      .from(callSessions)
      .where(
        and(
          eq(callSessions.toNumber, toNumber),
          eq(callSessions.status, "initiated"),
          isNull(callSessions.callSid)
        )
      )
      .orderBy(desc(callSessions.startedAt))
      .limit(1);
    return session;
  }

  async createCallSession(insertSession: InsertCallSession): Promise<CallSession> {
    const [session] = await db.insert(callSessions).values(insertSession).returning();
    return session;
  }

  async updateCallSession(id: string, updates: Partial<InsertCallSession>): Promise<CallSession | undefined> {
    const [session] = await db.update(callSessions).set(updates).where(eq(callSessions.id, id)).returning();
    return session;
  }

  async updateCallSessionByCallSid(callSid: string, updates: Partial<InsertCallSession>): Promise<CallSession | undefined> {
    const [session] = await db.update(callSessions).set(updates).where(eq(callSessions.callSid, callSid)).returning();
    return session;
  }

  async createManagerCallAnalysis(analysis: InsertManagerCallAnalysis): Promise<ManagerCallAnalysis> {
    const [result] = await db.insert(managerCallAnalyses).values(analysis).returning();
    return result;
  }

  async getManagerCallAnalysis(id: string): Promise<ManagerCallAnalysis | undefined> {
    const [result] = await db.select().from(managerCallAnalyses).where(eq(managerCallAnalyses.id, id));
    return result;
  }

  async getManagerCallAnalysisByCallSession(callSessionId: string): Promise<ManagerCallAnalysis | undefined> {
    const [result] = await db.select().from(managerCallAnalyses).where(eq(managerCallAnalyses.callSessionId, callSessionId));
    return result;
  }

  async getManagerCallAnalysesBySdr(sdrId: string): Promise<ManagerCallAnalysis[]> {
    return db.select().from(managerCallAnalyses)
      .where(eq(managerCallAnalyses.sdrId, sdrId))
      .orderBy(desc(managerCallAnalyses.analyzedAt));
  }

  async getAllManagerCallAnalyses(): Promise<ManagerCallAnalysis[]> {
    return db.select().from(managerCallAnalyses).orderBy(desc(managerCallAnalyses.analyzedAt));
  }

  async getManagerAnalysesByUser(userId: string): Promise<ManagerCallAnalysis[]> {
    const userSessions = await db.select({ id: callSessions.id })
      .from(callSessions)
      .where(eq(callSessions.userId, userId));
    
    if (userSessions.length === 0) return [];
    
    const sessionIds = userSessions.map(s => s.id);
    return db.select().from(managerCallAnalyses)
      .where(inArray(managerCallAnalyses.callSessionId, sessionIds))
      .orderBy(desc(managerCallAnalyses.analyzedAt));
  }

  async getCoachingTipsByUser(userId: string): Promise<LiveCoachingTip[]> {
    const userSessions = await db.select({ id: callSessions.id })
      .from(callSessions)
      .where(eq(callSessions.userId, userId));
    
    if (userSessions.length === 0) return [];
    
    const sessionIds = userSessions.map(s => s.id);
    return db.select().from(liveCoachingTips)
      .where(inArray(liveCoachingTips.sessionId, sessionIds))
      .orderBy(desc(liveCoachingTips.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async getNotificationsByUser(userId: string, limit: number = 50): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return Number(result[0]?.count ?? 0);
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [result] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return result;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  async getAllNavigationSettings(): Promise<NavigationSetting[]> {
    return db.select().from(navigationSettings).orderBy(navigationSettings.sortOrder);
  }

  async updateNavigationSetting(id: string, updates: { isEnabled?: boolean; sortOrder?: number }): Promise<NavigationSetting | undefined> {
    const [result] = await db.update(navigationSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigationSettings.id, id))
      .returning();
    return result;
  }

  async initializeNavigationSettings(): Promise<void> {
    const existing = await db.select().from(navigationSettings);
    if (existing.length > 0) return;

    const defaultSettings = [
      { navKey: "dashboard", label: "Dashboard", isEnabled: true, sortOrder: 0 },
      { navKey: "leads", label: "Leads", isEnabled: true, sortOrder: 1 },
      { navKey: "live_coaching", label: "Live Coaching", isEnabled: true, sortOrder: 2 },
      { navKey: "team", label: "Team", isEnabled: true, sortOrder: 3 },
      { navKey: "reports", label: "Reports", isEnabled: true, sortOrder: 4 },
      { navKey: "ae_pipeline", label: "AE Pipeline", isEnabled: true, sortOrder: 5 },
      { navKey: "budgeting", label: "Budgeting", isEnabled: true, sortOrder: 6 },
    ];

    for (const setting of defaultSettings) {
      await db.insert(navigationSettings).values(setting).onConflictDoNothing();
    }
    console.log("[Init] Navigation settings initialized");
  }

  async searchLeadsByName(searchName: string): Promise<Lead[]> {
    const searchPattern = `%${searchName.toLowerCase()}%`;
    return db.select().from(leads)
      .where(sql`LOWER(${leads.contactName}) LIKE ${searchPattern} OR LOWER(${leads.companyName}) LIKE ${searchPattern}`)
      .orderBy(desc(leads.lastContactedAt))
      .limit(10);
  }

  async getCallsWithTranscriptsByLead(leadId: string): Promise<Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>> {
    const results = await db
      .select({
        id: callSessions.id,
        callSid: callSessions.callSid,
        userId: callSessions.userId,
        leadId: callSessions.leadId,
        direction: callSessions.direction,
        fromNumber: callSessions.fromNumber,
        toNumber: callSessions.toNumber,
        status: callSessions.status,
        duration: callSessions.duration,
        recordingUrl: callSessions.recordingUrl,
        driveFileId: callSessions.driveFileId,
        transcriptText: callSessions.transcriptText,
        coachingNotes: callSessions.coachingNotes,
        managerSummary: callSessions.managerSummary,
        startedAt: callSessions.startedAt,
        endedAt: callSessions.endedAt,
        disposition: callSessions.disposition,
        keyTakeaways: callSessions.keyTakeaways,
        nextSteps: callSessions.nextSteps,
        sdrNotes: callSessions.sdrNotes,
        callbackDate: callSessions.callbackDate,
        sentimentScore: callSessions.sentimentScore,
        sdrName: users.name,
        leadName: leads.contactName,
        companyName: leads.companyName,
      })
      .from(callSessions)
      .leftJoin(users, eq(callSessions.userId, users.id))
      .leftJoin(leads, eq(callSessions.leadId, leads.id))
      .where(
        and(
          eq(callSessions.leadId, leadId),
          isNotNull(callSessions.transcriptText)
        )
      )
      .orderBy(desc(callSessions.startedAt))
      .limit(10);
    
    return results as Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>;
  }

  async searchSdrsByName(searchName: string): Promise<Array<{ sdr: Sdr; user: User }>> {
    const searchPattern = `%${searchName.toLowerCase()}%`;
    const results = await db
      .select({
        sdr: sdrs,
        user: users,
      })
      .from(sdrs)
      .innerJoin(users, eq(users.sdrId, sdrs.id))
      .where(sql`LOWER(${sdrs.name}) LIKE ${searchPattern} OR LOWER(${users.name}) LIKE ${searchPattern}`)
      .limit(5);
    return results;
  }

  async getCallsWithTranscriptsByUser(userId: string, limit: number = 10): Promise<Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>> {
    const results = await db
      .select({
        id: callSessions.id,
        callSid: callSessions.callSid,
        userId: callSessions.userId,
        leadId: callSessions.leadId,
        direction: callSessions.direction,
        fromNumber: callSessions.fromNumber,
        toNumber: callSessions.toNumber,
        status: callSessions.status,
        duration: callSessions.duration,
        recordingUrl: callSessions.recordingUrl,
        driveFileId: callSessions.driveFileId,
        transcriptText: callSessions.transcriptText,
        coachingNotes: callSessions.coachingNotes,
        managerSummary: callSessions.managerSummary,
        startedAt: callSessions.startedAt,
        endedAt: callSessions.endedAt,
        disposition: callSessions.disposition,
        keyTakeaways: callSessions.keyTakeaways,
        nextSteps: callSessions.nextSteps,
        sdrNotes: callSessions.sdrNotes,
        callbackDate: callSessions.callbackDate,
        sentimentScore: callSessions.sentimentScore,
        sdrName: users.name,
        leadName: leads.contactName,
        companyName: leads.companyName,
      })
      .from(callSessions)
      .leftJoin(users, eq(callSessions.userId, users.id))
      .leftJoin(leads, eq(callSessions.leadId, leads.id))
      .where(eq(callSessions.userId, userId))
      .orderBy(desc(callSessions.startedAt))
      .limit(limit);
    
    return results as Array<CallSession & { sdrName?: string; leadName?: string; companyName?: string }>;
  }
  
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    }).returning();
    return resetToken;
  }
  
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt)
      ));
    return resetToken;
  }
  
  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }
  
  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
  }

  // ─── Robin Config ────────────────────────────────────────────────────────
  async getRobinConfig(): Promise<RobinConfig | null> {
    const [config] = await db.select().from(robinConfig).where(eq(robinConfig.id, "default"));
    return config || null;
  }

  async upsertRobinConfig(data: Partial<InsertRobinConfig>): Promise<RobinConfig> {
    const [result] = await db
      .insert(robinConfig)
      .values({ id: "default", ...data })
      .onConflictDoUpdate({ target: robinConfig.id, set: { ...data, updatedAt: new Date() } })
      .returning();
    return result;
  }

  // ─── AE Territory Routing ────────────────────────────────────────────────
  async getAeTerritoryRouting(): Promise<AeTerritoryRouting[]> {
    return db.select().from(aeTerritoryRouting).orderBy(aeTerritoryRouting.priority);
  }

  async upsertAeTerritoryRoute(data: InsertAeTerritoryRouting & { id?: string }): Promise<AeTerritoryRouting> {
    if (data.id) {
      const [result] = await db
        .update(aeTerritoryRouting)
        .set(data)
        .where(eq(aeTerritoryRouting.id, data.id))
        .returning();
      return result;
    }
    const [result] = await db.insert(aeTerritoryRouting).values(data).returning();
    return result;
  }

  async deleteAeTerritoryRoute(id: string): Promise<void> {
    await db.delete(aeTerritoryRouting).where(eq(aeTerritoryRouting.id, id));
  }

  async resolveAEForLead(region: string): Promise<AccountExecutive | null> {
    // 1. Try territory routing table
    const routes = await db
      .select()
      .from(aeTerritoryRouting)
      .where(and(eq(aeTerritoryRouting.isActive, true)))
      .orderBy(aeTerritoryRouting.priority);

    const regionLower = region?.toLowerCase() || "";
    for (const route of routes) {
      if (route.region.toLowerCase() === regionLower && route.aeId) {
        const [ae] = await db.select().from(accountExecutives).where(and(eq(accountExecutives.id, route.aeId), eq(accountExecutives.isActive, true)));
        if (ae) return ae;
      }
    }

    // 2. Try matching account_executives.region directly
    const allAes = await db.select().from(accountExecutives).where(eq(accountExecutives.isActive, true));
    const match = allAes.find(ae => ae.region && ae.region.toLowerCase() === regionLower);
    if (match) return match;

    // 3. Fallback: check robin_config.fallback_ae_id
    const config = await this.getRobinConfig();
    if (config?.fallbackAeId) {
      const [ae] = await db.select().from(accountExecutives).where(eq(accountExecutives.id, config.fallbackAeId));
      if (ae) return ae;
    }

    // 4. Final fallback: any active AE
    return allAes[0] || null;
  }
}

export const storage = new DatabaseStorage();
