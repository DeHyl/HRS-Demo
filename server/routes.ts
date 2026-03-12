import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { storage } from "./storage";
import { pool } from "./db";
import { insertUserSchema } from "@shared/schema";
import { sendFeedbackEmail } from "./google/gmailClient";
import { z } from "zod";
import { registerTwilioVoiceRoutes } from "./twilio-voice";
import { registerTranscriptionRoutes, setupTranscriptionWebSocket } from "./transcription";
import { registerLeadsRoutes } from "./leads-routes";
import { registerCoachRoutes } from "./coach-routes";
import { registerSalesforceRoutes } from "./salesforce-routes";
import { registerSupportRoutes } from "./support-routes";
import { registerZoomRoutes } from "./zoom-routes";
import { registerAgentRoutes } from "./agent-routes";
import reportRoutes from "./report-routes";
import aiReportsRoutes from "./ai-reports-routes";
import baselineRoutes from "./baseline-routes";
import { listFilesInProcessed } from "./google/driveClient";
import { notifyCallCompleted, notifyResearchComplete } from "./dashboardUpdates";
import { 
  hashPassword, 
  verifyPassword, 
  setUserSession, 
  excludePassword, 
  excludePasswordFromAll,
  validatePasswordStrength
} from "./helpers/authHelpers";

declare module "express-session" {
  interface SessionData {
    userId: string;
    userRole?: string;
  }
}

const MemoryStoreSession = MemoryStore(session);
const PgSession = connectPgSimple(session);

// Rate limiter for auth endpoints: 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Validation schemas for PATCH endpoints
const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).strict();

const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "manager", "sdr", "account_specialist", "account_executive"]),
}).strict();

const updateSdrSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  managerId: z.string().optional(),
  gender: z.string().optional(),
  timezone: z.string().optional(),
}).strict();

const updateCallOutcomeSchema = z.object({
  disposition: z.enum(["connected", "voicemail", "no_answer", "busy", "invalid_number", "do_not_call"]).optional(),
  nextSteps: z.string().optional(),
  keyTakeaways: z.string().optional(),
  sdrNotes: z.string().optional(),
  callbackDate: z.string().datetime().or(z.date()).optional(),
}).strict();

const updateManagerNotesSchema = z.object({
  managerSummary: z.string().optional(),
  coachingNotes: z.string().optional(),
  sentimentScore: z.number().min(0).max(10).optional(),
}).strict();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(express.urlencoded({ extended: true }));

  // Always use PostgreSQL for persistent sessions across restarts
  console.log("Using PostgreSQL session store for persistent sessions");
  const sessionStore = new PgSession({
    pool: pool,
    tableName: "session",
    createTableIfMissing: true,
    errorLog: (error: Error) => {
      console.error("PgSession error:", error);
    },
  });

  // Validate critical environment variables
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required. Set it in your .env file or Replit Secrets.");
  }

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: "lax",
      },
    })
  );

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireRole = (...allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      try {
        const user = await storage.getUser(req.session.userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (!allowedRoles.includes(user.role)) {
          return res.status(403).json({ message: "Access denied. Insufficient permissions." });
        }

        req.session.userRole = user.role;
        next();
      } catch (error) {
        console.error("Role check error:", error);
        res.status(500).json({ message: "Authorization check failed" });
      }
    };
  };

  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPwd = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPwd,
      });

      setUserSession(req.session, user);
      res.status(201).json({ user: excludePassword(user) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      console.log("Login attempt for:", email);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log("Login failed - user not found:", email);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        console.log("Login failed - invalid password for:", email);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await storage.updateUserLastLogin(user.id);
      setUserSession(req.session, user);

      // Explicitly save session to ensure it's persisted before responding
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.status(500).json({ message: "Login failed - session error" });
        }
        
        console.log("Login successful - Session ID:", req.sessionID);
        console.log("Login successful - User ID set:", user.id);
        res.json({ user: excludePassword(user) });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        
        await storage.createPasswordResetToken(user.id, token, expiresAt);
        
        const resetUrl = `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000'}/reset-password?token=${token}`;
        
        const emailBody = `
          <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #1f2937; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
              </div>
              <div style="padding: 24px; background: #f9fafb; border-radius: 0 0 12px 12px;">
                <p>Hi ${user.name},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetUrl}" style="background: #E5C100; color: #1f2937; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                <p style="color: #9ca3af; font-size: 12px;">Lead Intel by BSA Solutions</p>
              </div>
            </body>
          </html>
        `;
        
        await sendFeedbackEmail({
          to: user.email,
          subject: "Reset Your Lead Intel Password",
          body: emailBody,
        });
        
        console.log("Password reset email sent to:", email);
      }
      
      res.json({ message: "If an account exists with that email, a password reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(6, "Password must be at least 6 characters"),
      }).parse(req.body);
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }
      
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }
      
      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      await storage.markPasswordResetTokenUsed(resetToken.id);
      
      console.log("Password reset successful for user:", resetToken.userId);
      res.json({ message: "Password reset successful. You can now log in with your new password." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.json({ user: null });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null });
      }

      res.json({ user: excludePassword(user) });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Authentication check failed" });
    }
  });

  app.get("/api/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(excludePassword(user));
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  app.patch("/api/user/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = updateUserProfileSchema.parse(req.body);
      const updates: { name?: string; email?: string } = {};

      if (validatedData.name) {
        updates.name = validatedData.name.trim();
      }
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email.trim());
        if (existingUser && existingUser.id !== req.session.userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
        updates.email = validatedData.email.trim();
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }
      
      const user = await storage.updateUserProfile(req.session.userId!, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(excludePassword(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch("/api/user/password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }

      const passwordCheck = validatePasswordStrength(newPassword);
      if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashedPwd = await hashPassword(newPassword);
      await storage.updateUserPassword(req.session.userId!, hashedPwd);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Update password error:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.get("/api/users", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(excludePasswordFromAll(allUsers));
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/role", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const { role } = updateUserRoleSchema.parse(req.body);

      if (id === req.session.userId && role !== "admin") {
        return res.status(400).json({ message: "Cannot demote yourself" });
      }
      
      const user = await storage.updateUserRole(id, role);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(excludePassword(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Update role error:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/users/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      if (id === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete yourself" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      const unreadCount = await storage.getUnreadNotificationCount(req.session.userId!);
      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationRead(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.markAllNotificationsRead(req.session.userId!);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.get("/api/navigation-settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAllNavigationSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get navigation settings error:", error);
      res.status(500).json({ message: "Failed to fetch navigation settings" });
    }
  });

  app.patch("/api/navigation-settings/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isEnabled, sortOrder } = req.body;
      
      const updates: { isEnabled?: boolean; sortOrder?: number } = {};
      if (typeof isEnabled === "boolean") updates.isEnabled = isEnabled;
      if (typeof sortOrder === "number") updates.sortOrder = sortOrder;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }
      
      const setting = await storage.updateNavigationSetting(id, updates);
      if (!setting) {
        return res.status(404).json({ message: "Navigation setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Update navigation setting error:", error);
      res.status(500).json({ message: "Failed to update navigation setting" });
    }
  });

  app.get("/api/learning/insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const callSessions = await storage.getCallSessionsByUser(userId);
      const managerAnalyses = await storage.getManagerAnalysesByUser(userId);
      const coachingTips = await storage.getCoachingTipsByUser(userId);
      
      const scoresByDimension = {
        opening: 0,
        discovery: 0,
        valueProposition: 0,
        objectionHandling: 0,
        closing: 0,
        tone: 0,
        compliance: 0,
      };
      
      let totalScore = 0;
      const allStrengths: string[] = [];
      const allImprovements: string[] = [];
      
      if (managerAnalyses.length > 0) {
        for (const analysis of managerAnalyses) {
          totalScore += analysis.overallScore || 0;
          scoresByDimension.opening += analysis.openingScore || 0;
          scoresByDimension.discovery += analysis.discoveryScore || 0;
          scoresByDimension.valueProposition += analysis.valuePropositionScore || 0;
          scoresByDimension.objectionHandling += analysis.objectionScore || 0;
          scoresByDimension.closing += analysis.closingScore || 0;
          scoresByDimension.tone += analysis.listeningScore || 0;
          scoresByDimension.compliance += analysis.complianceScore || 0;
          
          if (analysis.keyObservations) {
            const observations = analysis.keyObservations.split(/[.!?]/).filter(s => s.trim());
            allStrengths.push(...observations.slice(0, 2).map(s => s.trim()));
          }
          if (analysis.recommendations) {
            const recs = analysis.recommendations.split(/[.!?]/).filter(s => s.trim());
            allImprovements.push(...recs.slice(0, 2).map(s => s.trim()));
          }
        }
        
        const count = managerAnalyses.length;
        scoresByDimension.opening /= count;
        scoresByDimension.discovery /= count;
        scoresByDimension.valueProposition /= count;
        scoresByDimension.objectionHandling /= count;
        scoresByDimension.closing /= count;
        scoresByDimension.tone /= count;
        scoresByDimension.compliance /= count;
        totalScore /= count;
      }
      
      const strengthCounts: Record<string, number> = {};
      const improvementCounts: Record<string, number> = {};
      
      allStrengths.forEach(s => {
        if (s.length > 10) strengthCounts[s] = (strengthCounts[s] || 0) + 1;
      });
      allImprovements.forEach(i => {
        if (i.length > 10) improvementCounts[i] = (improvementCounts[i] || 0) + 1;
      });
      
      const topStrengths = Object.entries(strengthCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s]) => s);
      
      const areasForImprovement = Object.entries(improvementCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([i]) => i);
      
      const recentAnalyses = managerAnalyses.slice(0, 10).map(analysis => {
        const session = callSessions.find(s => s.id === analysis.callSessionId);
        return {
          ...analysis,
          session: session ? {
            toNumber: session.toNumber,
            duration: session.duration,
            startedAt: session.startedAt,
          } : undefined,
        };
      });
      
      res.json({
        recentTips: coachingTips.slice(0, 20),
        recentAnalyses,
        performanceStats: {
          totalCalls: callSessions.length,
          analyzedCalls: managerAnalyses.length,
          averageScore: totalScore,
          scoresByDimension,
        },
        topStrengths,
        areasForImprovement,
      });
    } catch (error) {
      console.error("Learning insights error:", error);
      res.status(500).json({ message: "Failed to fetch learning insights" });
    }
  });

  app.get("/api/managers", requireAuth, async (req: Request, res: Response) => {
    try {
      const allManagers = await storage.getAllManagers();
      res.json(allManagers);
    } catch (error) {
      console.error("Get managers error:", error);
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  app.get("/api/managers/:id/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const manager = await storage.getManager(req.params.id);
      if (!manager) {
        return res.status(404).json({ message: "Manager not found" });
      }

      // Fetch base data
      const allSdrs = await storage.getSdrsByManager(manager.id);
      const allUsers = await storage.getAllUsers();
      const sdrUserMap = new Map<string, string>();
      for (const u of allUsers) {
        if (u.sdrId) sdrUserMap.set(u.sdrId, u.id);
      }

      // Initialize date ranges and metrics
      const dateRanges = getDateRanges();
      const weeklyActivity = initializeWeeklyActivity();
      const teamMetrics = createEmptyTeamMetrics(allSdrs.length);

      // Aggregate SDR performance data
      const team: TeamMember[] = [];
      let totalConnectRates = 0;
      let sdrsWithCalls = 0;

      for (const sdr of allSdrs) {
        const userId = sdrUserMap.get(sdr.id);
        let sdrMetrics = { weekCalls: 0, weekQualified: 0, weekMeetings: 0, connectRate: 0, trend: 0 };

        if (userId) {
          const calls = await storage.getCallSessionsByUser(userId);
          const callMetrics = processSdrCalls(calls, dateRanges, weeklyActivity);

          // Update team metrics
          teamMetrics.weekCalls += callMetrics.weekCalls;
          teamMetrics.lastWeekCalls += callMetrics.lastWeekCalls;
          teamMetrics.totalCalls += calls.length;
          teamMetrics.weekQualified += callMetrics.weekQualified;
          teamMetrics.weekMeetings += callMetrics.weekMeetings;
          teamMetrics.lastWeekQualified += callMetrics.lastWeekQualified;
          teamMetrics.lastWeekMeetings += callMetrics.lastWeekMeetings;

          // Calculate SDR performance
          sdrMetrics = {
            weekCalls: callMetrics.weekCalls,
            weekQualified: callMetrics.weekQualified,
            weekMeetings: callMetrics.weekMeetings,
            connectRate: calculateConnectRate(callMetrics.connected, callMetrics.weekCalls),
            trend: calculateTrend(callMetrics.weekCalls, callMetrics.lastWeekCalls),
          };

          if (callMetrics.weekCalls > 0) {
            totalConnectRates += sdrMetrics.connectRate;
            sdrsWithCalls++;
          }
        }

        team.push({
          id: sdr.id,
          name: sdr.name,
          email: sdr.email,
          performance: sdrMetrics,
        });
      }

      // Calculate team average connect rate
      teamMetrics.avgConnectRate = sdrsWithCalls > 0 ? Math.round(totalConnectRates / sdrsWithCalls) : 0;

      // Process coaching data
      const allAnalyses = await storage.getAllManagerCallAnalyses();
      const teamAnalyses = allAnalyses.filter((a: any) => allSdrs.some((s: any) => s.id === a.sdrId));
      const coachingMetrics = calculateCoachingMetrics(teamAnalyses);
      teamMetrics.coachingSessionsGiven = coachingMetrics.sessionsGiven;
      teamMetrics.avgCoachingScore = coachingMetrics.avgScore;

      // Calculate trends
      const trends = {
        callsTrend: calculateTrend(teamMetrics.weekCalls, teamMetrics.lastWeekCalls),
        qualifiedTrend: calculateTrend(teamMetrics.weekQualified, teamMetrics.lastWeekQualified),
        meetingsTrend: calculateTrend(teamMetrics.weekMeetings, teamMetrics.lastWeekMeetings),
      };

      // Derive summary data
      const topPerformers = getTopPerformers(team, 5);
      const recentCoachingSessions = teamAnalyses.slice(0, 10).map(formatCoachingSession);
      const achievements = generateAchievements(
        allSdrs.length,
        teamMetrics.coachingSessionsGiven,
        teamMetrics.avgCoachingScore,
        teamMetrics.weekMeetings
      );

      res.json({
        manager,
        team,
        teamMetrics,
        trends,
        weeklyActivity,
        topPerformers,
        recentCoachingSessions,
        achievements,
      });
    } catch (error) {
      console.error("Get manager profile error:", error);
      res.status(500).json({ message: "Failed to fetch manager profile" });
    }
  });

  app.get("/api/sdrs", requireAuth, async (req: Request, res: Response) => {
    try {
      const allSdrs = await storage.getAllSdrs();
      res.json(allSdrs);
    } catch (error) {
      console.error("Get SDRs error:", error);
      res.status(500).json({ message: "Failed to fetch SDRs" });
    }
  });

  app.get("/api/sdrs/by-manager/:managerId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { managerId } = req.params;
      const managerSdrs = await storage.getSdrsByManager(managerId);
      res.json(managerSdrs);
    } catch (error) {
      console.error("Get SDRs by manager error:", error);
      res.status(500).json({ message: "Failed to fetch SDRs" });
    }
  });

  // SDR details for modal - aggregates SDR info, stats, recent calls, and assigned leads
  app.get("/api/sdrs/:id/details", requireAuth, async (req: Request, res: Response) => {
    try {
      const sdr = await storage.getSdr(req.params.id);
      if (!sdr) {
        return res.status(404).json({ message: "SDR not found" });
      }

      // Get user associated with this SDR
      const user = await storage.getUserBySdrId(sdr.id);
      const userId = user?.id;

      // Get call sessions for this SDR (via their user account)
      let recentCalls: any[] = [];
      let stats = {
        totalCalls: 0,
        totalQualified: 0,
        totalMeetings: 0,
        avgCallDuration: 0,
        connectRate: 0,
        conversionRate: 0,
      };
      let dispositionBreakdown: Record<string, number> = {};

      if (userId) {
        const allCalls = await storage.getCallSessionsByUser(userId);

        // Calculate stats
        stats.totalCalls = allCalls.length;
        let connectedCalls = 0;
        let totalDuration = 0;

        for (const call of allCalls) {
          if (call.disposition) {
            dispositionBreakdown[call.disposition] = (dispositionBreakdown[call.disposition] || 0) + 1;

            if (call.disposition === 'qualified') stats.totalQualified++;
            if (call.disposition === 'meeting-booked') stats.totalMeetings++;
            if (['connected', 'qualified', 'meeting-booked', 'callback-scheduled', 'not-interested'].includes(call.disposition)) {
              connectedCalls++;
            }
          }
          if (call.duration) totalDuration += call.duration;
        }

        stats.avgCallDuration = stats.totalCalls > 0 ? Math.round(totalDuration / stats.totalCalls) : 0;
        stats.connectRate = stats.totalCalls > 0 ? Math.round((connectedCalls / stats.totalCalls) * 100) : 0;
        stats.conversionRate = stats.totalCalls > 0 ? Math.round((stats.totalQualified / stats.totalCalls) * 100) : 0;

        // Get recent calls with lead info
        const recentCallData = allCalls.slice(0, 10);
        for (const call of recentCallData) {
          let leadName = "Unknown";
          let companyName = "Unknown";
          if (call.leadId) {
            const lead = await storage.getLead(call.leadId);
            if (lead) {
              leadName = lead.contactName;
              companyName = lead.companyName;
            }
          }
          recentCalls.push({
            id: call.id,
            leadName,
            companyName,
            disposition: call.disposition || 'unknown',
            duration: call.duration,
            startedAt: call.startedAt,
          });
        }
      }

      // Get assigned leads for this SDR
      const allLeads = await storage.getAllLeads();
      const assignedLeads = allLeads
        .filter(lead => lead.assignedSdrId === sdr.id)
        .slice(0, 20)
        .map(lead => ({
          id: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          status: lead.status,
          fitScore: lead.fitScore,
        }));

      res.json({
        sdr: {
          id: sdr.id,
          name: sdr.name,
          email: sdr.email,
          timezone: sdr.timezone,
          isActive: sdr.isActive,
        },
        stats,
        recentCalls,
        assignedLeads,
        dispositionBreakdown,
      });
    } catch (error) {
      console.error("Get SDR details error:", error);
      res.status(500).json({ message: "Failed to fetch SDR details" });
    }
  });

  // Comprehensive SDR profile for manager view - full performance dashboard
  app.get("/api/sdrs/:id/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const sdr = await storage.getSdr(req.params.id);
      if (!sdr) {
        return res.status(404).json({ message: "SDR not found" });
      }

      // Get user associated with this SDR
      const user = await storage.getUserBySdrId(sdr.id);
      const userId = user?.id;

      // Get manager info
      let manager = null;
      if (sdr.managerId) {
        manager = await storage.getManager(sdr.managerId);
      }

      // Initialize comprehensive stats
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      let allCalls: any[] = [];
      let weeklyActivity: { date: string; calls: number; qualified: number; meetings: number }[] = [];
      let callsByHour: Record<number, { calls: number; connected: number }> = {};

      // Performance metrics
      let performance = {
        totalCalls: 0,
        totalConnected: 0,
        totalQualified: 0,
        totalMeetings: 0,
        totalTalkTimeSeconds: 0,
        avgCallDuration: 0,
        connectRate: 0,
        conversionRate: 0,
        meetingRate: 0,
        // Weekly metrics
        weekCalls: 0,
        weekConnected: 0,
        weekQualified: 0,
        weekMeetings: 0,
        // Monthly metrics
        monthCalls: 0,
        monthConnected: 0,
        monthQualified: 0,
        monthMeetings: 0,
        // Last month (for comparison)
        lastMonthCalls: 0,
        lastMonthQualified: 0,
        lastMonthMeetings: 0,
      };

      let dispositionBreakdown: Record<string, number> = {};
      let recentCalls: any[] = [];
      let achievements: { title: string; description: string; date?: string; icon: string }[] = [];

      if (userId) {
        allCalls = await storage.getCallSessionsByUser(userId);

        // Sort by date descending
        allCalls.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

        // Calculate all metrics
        for (const call of allCalls) {
          const callDate = new Date(call.startedAt);
          const isThisWeek = callDate >= startOfWeek;
          const isThisMonth = callDate >= startOfMonth;
          const isLastMonth = callDate >= startOfLastMonth && callDate <= endOfLastMonth;

          performance.totalCalls++;
          if (isThisWeek) performance.weekCalls++;
          if (isThisMonth) performance.monthCalls++;
          if (isLastMonth) performance.lastMonthCalls++;

          if (call.duration) {
            performance.totalTalkTimeSeconds += call.duration;
          }

          // Track calls by hour for best time analysis
          const hour = callDate.getHours();
          if (!callsByHour[hour]) callsByHour[hour] = { calls: 0, connected: 0 };
          callsByHour[hour].calls++;

          if (call.disposition) {
            dispositionBreakdown[call.disposition] = (dispositionBreakdown[call.disposition] || 0) + 1;

            const isConnected = ['connected', 'qualified', 'meeting-booked', 'callback-scheduled', 'not-interested'].includes(call.disposition);

            if (isConnected) {
              performance.totalConnected++;
              if (isThisWeek) performance.weekConnected++;
              if (isThisMonth) performance.monthConnected++;
              callsByHour[hour].connected++;
            }

            if (call.disposition === 'qualified') {
              performance.totalQualified++;
              if (isThisWeek) performance.weekQualified++;
              if (isThisMonth) performance.monthQualified++;
              if (isLastMonth) performance.lastMonthQualified++;
            }

            if (call.disposition === 'meeting-booked') {
              performance.totalMeetings++;
              if (isThisWeek) performance.weekMeetings++;
              if (isThisMonth) performance.monthMeetings++;
              if (isLastMonth) performance.lastMonthMeetings++;
            }
          }
        }

        // Calculate rates
        performance.avgCallDuration = performance.totalCalls > 0
          ? Math.round(performance.totalTalkTimeSeconds / performance.totalCalls)
          : 0;
        performance.connectRate = performance.totalCalls > 0
          ? Math.round((performance.totalConnected / performance.totalCalls) * 100)
          : 0;
        performance.conversionRate = performance.totalCalls > 0
          ? Math.round((performance.totalQualified / performance.totalCalls) * 100)
          : 0;
        performance.meetingRate = performance.totalCalls > 0
          ? Math.round((performance.totalMeetings / performance.totalCalls) * 100)
          : 0;

        // Build weekly activity (last 7 days)
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayCalls = allCalls.filter(c => {
            const callDate = new Date(c.startedAt);
            return callDate >= date && callDate < nextDate;
          });

          weeklyActivity.push({
            date: days[date.getDay()],
            calls: dayCalls.length,
            qualified: dayCalls.filter(c => c.disposition === 'qualified').length,
            meetings: dayCalls.filter(c => c.disposition === 'meeting-booked').length,
          });
        }

        // Get recent calls with lead info
        for (const call of allCalls.slice(0, 15)) {
          let leadName = "Unknown";
          let companyName = "Unknown";
          let leadId = null;
          if (call.leadId) {
            const lead = await storage.getLead(call.leadId);
            if (lead) {
              leadName = lead.contactName;
              companyName = lead.companyName;
              leadId = lead.id;
            }
          }
          recentCalls.push({
            id: call.id,
            leadId,
            leadName,
            companyName,
            disposition: call.disposition || 'unknown',
            duration: call.duration,
            startedAt: call.startedAt,
            keyTakeaways: call.keyTakeaways,
            sentimentScore: call.sentimentScore,
          });
        }

        // Generate achievements
        if (performance.totalMeetings >= 10) {
          achievements.push({
            title: "Meeting Machine",
            description: `Booked ${performance.totalMeetings} meetings total`,
            icon: "calendar",
          });
        }
        if (performance.totalQualified >= 25) {
          achievements.push({
            title: "Lead Qualifier",
            description: `Qualified ${performance.totalQualified} leads total`,
            icon: "target",
          });
        }
        if (performance.connectRate >= 50) {
          achievements.push({
            title: "Connection Master",
            description: `${performance.connectRate}% connect rate`,
            icon: "phone",
          });
        }
        if (performance.totalCalls >= 100) {
          achievements.push({
            title: "Century Club",
            description: `Made ${performance.totalCalls} calls`,
            icon: "trophy",
          });
        }
        if (performance.weekQualified >= 5) {
          achievements.push({
            title: "Hot Week",
            description: `${performance.weekQualified} qualified leads this week`,
            icon: "flame",
          });
        }
      }

      // Get assigned leads with full details
      const allLeads = await storage.getAllLeads();
      const assignedLeads = allLeads.filter(lead => lead.assignedSdrId === sdr.id);

      // Lead portfolio analysis
      const leadPortfolio = {
        total: assignedLeads.length,
        byStatus: {} as Record<string, number>,
        byPriority: { hot: 0, warm: 0, cold: 0, unset: 0 },
        avgFitScore: 0,
        needsFollowUp: 0,
        recentlyContacted: 0,
      };

      let totalFitScore = 0;
      let fitScoreCount = 0;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      for (const lead of assignedLeads) {
        // By status
        leadPortfolio.byStatus[lead.status] = (leadPortfolio.byStatus[lead.status] || 0) + 1;

        // By priority
        if (lead.priority === 'hot') leadPortfolio.byPriority.hot++;
        else if (lead.priority === 'warm') leadPortfolio.byPriority.warm++;
        else if (lead.priority === 'cold') leadPortfolio.byPriority.cold++;
        else leadPortfolio.byPriority.unset++;

        // Fit score
        if (lead.fitScore !== null) {
          totalFitScore += lead.fitScore;
          fitScoreCount++;
        }

        // Follow-up needed
        if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= now) {
          leadPortfolio.needsFollowUp++;
        }

        // Recently contacted
        if (lead.lastContactedAt && new Date(lead.lastContactedAt) >= oneWeekAgo) {
          leadPortfolio.recentlyContacted++;
        }
      }

      leadPortfolio.avgFitScore = fitScoreCount > 0 ? Math.round(totalFitScore / fitScoreCount) : 0;

      // Get top leads (hot priority or high fit score)
      const topLeads = assignedLeads
        .filter(l => l.priority === 'hot' || (l.fitScore && l.fitScore >= 70))
        .slice(0, 10)
        .map(lead => ({
          id: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          status: lead.status,
          fitScore: lead.fitScore,
          priority: lead.priority,
          nextFollowUpAt: lead.nextFollowUpAt,
        }));

      // Calculate best calling hours
      const bestHours = Object.entries(callsByHour)
        .map(([hour, data]) => ({
          hour: parseInt(hour),
          calls: data.calls,
          connected: data.connected,
          connectRate: data.calls > 0 ? Math.round((data.connected / data.calls) * 100) : 0,
        }))
        .filter(h => h.calls >= 3) // Only hours with enough data
        .sort((a, b) => b.connectRate - a.connectRate)
        .slice(0, 3);

      // Get coaching insights from manager analyses if available
      let coachingInsights = {
        avgOverallScore: null as number | null,
        avgOpeningScore: null as number | null,
        avgDiscoveryScore: null as number | null,
        avgListeningScore: null as number | null,
        avgClosingScore: null as number | null,
        recentFeedback: [] as { date: string; score: number; summary: string }[],
        strengths: [] as string[],
        areasForImprovement: [] as string[],
      };

      try {
        const analyses = await storage.getManagerCallAnalysesBySdr(sdr.id);
        if (analyses && analyses.length > 0) {
          let totalOverall = 0, totalOpening = 0, totalDiscovery = 0, totalListening = 0, totalClosing = 0;
          let count = 0;

          for (const analysis of analyses.slice(0, 20)) {
            if (analysis.overallScore) {
              totalOverall += analysis.overallScore;
              count++;
            }
            if (analysis.openingScore) totalOpening += analysis.openingScore;
            if (analysis.discoveryScore) totalDiscovery += analysis.discoveryScore;
            if (analysis.listeningScore) totalListening += analysis.listeningScore;
            if (analysis.closingScore) totalClosing += analysis.closingScore;
          }

          if (count > 0) {
            coachingInsights.avgOverallScore = Math.round(totalOverall / count);
            coachingInsights.avgOpeningScore = Math.round(totalOpening / count);
            coachingInsights.avgDiscoveryScore = Math.round(totalDiscovery / count);
            coachingInsights.avgListeningScore = Math.round(totalListening / count);
            coachingInsights.avgClosingScore = Math.round(totalClosing / count);

            // Identify strengths and weaknesses
            const scores = [
              { name: 'Opening', score: coachingInsights.avgOpeningScore },
              { name: 'Discovery', score: coachingInsights.avgDiscoveryScore },
              { name: 'Listening', score: coachingInsights.avgListeningScore },
              { name: 'Closing', score: coachingInsights.avgClosingScore },
            ].filter(s => s.score !== null);

            scores.sort((a, b) => (b.score || 0) - (a.score || 0));
            coachingInsights.strengths = scores.slice(0, 2).filter(s => (s.score || 0) >= 70).map(s => s.name);
            coachingInsights.areasForImprovement = scores.slice(-2).filter(s => (s.score || 0) < 70).map(s => s.name);
          }

          // Recent feedback
          for (const analysis of analyses.slice(0, 5)) {
            if (analysis.overallScore && analysis.managerSummary) {
              coachingInsights.recentFeedback.push({
                date: analysis.createdAt.toISOString(),
                score: analysis.overallScore,
                summary: analysis.managerSummary.slice(0, 200),
              });
            }
          }
        }
      } catch (e) {
        // Coaching insights not critical, continue without them
      }

      // Calculate month-over-month trends
      const trends = {
        callsTrend: performance.lastMonthCalls > 0
          ? Math.round(((performance.monthCalls - performance.lastMonthCalls) / performance.lastMonthCalls) * 100)
          : 0,
        qualifiedTrend: performance.lastMonthQualified > 0
          ? Math.round(((performance.monthQualified - performance.lastMonthQualified) / performance.lastMonthQualified) * 100)
          : 0,
        meetingsTrend: performance.lastMonthMeetings > 0
          ? Math.round(((performance.monthMeetings - performance.lastMonthMeetings) / performance.lastMonthMeetings) * 100)
          : 0,
      };

      res.json({
        sdr: {
          id: sdr.id,
          name: sdr.name,
          email: sdr.email,
          timezone: sdr.timezone,
          isActive: sdr.isActive,
          createdAt: sdr.createdAt,
        },
        manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
        performance,
        trends,
        dispositionBreakdown,
        weeklyActivity,
        bestHours,
        recentCalls,
        leadPortfolio,
        topLeads,
        achievements,
        coachingInsights,
      });
    } catch (error) {
      console.error("Get SDR profile error:", error);
      res.status(500).json({ message: "Failed to fetch SDR profile" });
    }
  });

  // Team averages for SDR comparison
  app.get("/api/team-averages", requireAuth, async (req: Request, res: Response) => {
    try {
      const allSdrs = await storage.getAllSdrs();
      const allUsers = await storage.getAllUsers();

      // Build SDR to User map
      const sdrUserMap = new Map<string, string>();
      for (const u of allUsers) {
        if (u.sdrId) sdrUserMap.set(u.sdrId, u.id);
      }

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalCalls = 0;
      let totalConnected = 0;
      let totalQualified = 0;
      let totalMeetings = 0;
      let totalTalkTime = 0;
      let weekCalls = 0;
      let weekConnected = 0;
      let weekQualified = 0;
      let weekMeetings = 0;
      let monthCalls = 0;
      let monthConnected = 0;
      let monthQualified = 0;
      let monthMeetings = 0;
      let sdrCount = 0;

      for (const sdr of allSdrs) {
        const userId = sdrUserMap.get(sdr.id);
        if (!userId) continue;

        const calls = await storage.getCallSessionsByUser(userId);
        if (calls.length === 0) continue;

        sdrCount++;

        for (const call of calls) {
          const callDate = new Date(call.startedAt);
          const isThisWeek = callDate >= startOfWeek;
          const isThisMonth = callDate >= startOfMonth;

          totalCalls++;
          if (isThisWeek) weekCalls++;
          if (isThisMonth) monthCalls++;

          if (call.duration) {
            totalTalkTime += call.duration;
          }

          if (call.disposition) {
            const isConnected = ['connected', 'qualified', 'meeting-booked', 'callback-scheduled', 'not-interested'].includes(call.disposition);
            if (isConnected) {
              totalConnected++;
              if (isThisWeek) weekConnected++;
              if (isThisMonth) monthConnected++;
            }
            if (call.disposition === 'qualified') {
              totalQualified++;
              if (isThisWeek) weekQualified++;
              if (isThisMonth) monthQualified++;
            }
            if (call.disposition === 'meeting-booked') {
              totalMeetings++;
              if (isThisWeek) weekMeetings++;
              if (isThisMonth) monthMeetings++;
            }
          }
        }
      }

      const avgDivisor = sdrCount || 1;

      res.json({
        sdrCount,
        // All-time averages per SDR
        avgTotalCalls: Math.round(totalCalls / avgDivisor),
        avgTotalConnected: Math.round(totalConnected / avgDivisor),
        avgTotalQualified: Math.round(totalQualified / avgDivisor),
        avgTotalMeetings: Math.round(totalMeetings / avgDivisor),
        avgConnectRate: totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0,
        avgConversionRate: totalCalls > 0 ? Math.round((totalQualified / totalCalls) * 100) : 0,
        avgMeetingRate: totalCalls > 0 ? Math.round((totalMeetings / totalCalls) * 100) : 0,
        // Weekly averages per SDR
        avgWeekCalls: Math.round(weekCalls / avgDivisor),
        avgWeekConnected: Math.round(weekConnected / avgDivisor),
        avgWeekQualified: Math.round(weekQualified / avgDivisor),
        avgWeekMeetings: Math.round(weekMeetings / avgDivisor),
        // Monthly averages per SDR
        avgMonthCalls: Math.round(monthCalls / avgDivisor),
        avgMonthConnected: Math.round(monthConnected / avgDivisor),
        avgMonthQualified: Math.round(monthQualified / avgDivisor),
        avgMonthMeetings: Math.round(monthMeetings / avgDivisor),
      });
    } catch (error) {
      console.error("Get team averages error:", error);
      res.status(500).json({ message: "Failed to fetch team averages" });
    }
  });

  app.patch("/api/sdrs/:id", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const updates = updateSdrSchema.parse(req.body);

      const sdr = await storage.updateSdr(id, updates);
      if (!sdr) {
        return res.status(404).json({ message: "SDR not found" });
      }

      res.json(sdr);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Update SDR error:", error);
      res.status(500).json({ message: "Failed to update SDR" });
    }
  });

  app.delete("/api/sdrs/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteSdr(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete SDR error:", error);
      res.status(500).json({ message: "Failed to delete SDR" });
    }
  });

  app.post("/api/sdrs", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id, name, email, managerEmail, managerId, gender, timezone } = req.body;
      
      if (!id || !name || !email || !managerEmail) {
        return res.status(400).json({ message: "ID, name, email, and manager email are required" });
      }
      
      const sdr = await storage.createSdr({
        id,
        name,
        email,
        managerEmail,
        managerId: managerId || null,
        gender: gender || "neutral",
        timezone: timezone || null,
        isActive: true
      });
      
      res.json(sdr);
    } catch (error) {
      console.error("Create SDR error:", error);
      res.status(500).json({ message: "Failed to create SDR" });
    }
  });

  app.post("/api/managers", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      const manager = await storage.createManager({
        name,
        email,
        isActive: true
      });
      
      res.json(manager);
    } catch (error) {
      console.error("Create Manager error:", error);
      res.status(500).json({ message: "Failed to create manager" });
    }
  });

  app.get("/api/team", requireAuth, async (req: Request, res: Response) => {
    try {
      const allManagers = await storage.getAllManagers();
      const allSdrs = await storage.getAllSdrs();
      
      const teamByManager = allManagers.map(manager => ({
        manager,
        sdrs: allSdrs.filter(sdr => sdr.managerId === manager.id)
      }));

      const unassignedSdrs = allSdrs.filter(sdr => !sdr.managerId);

      res.json({ teamByManager, unassignedSdrs, totalManagers: allManagers.length, totalSdrs: allSdrs.length });
    } catch (error) {
      console.error("Team fetch error:", error);
      res.status(500).json({ message: "Failed to fetch team data" });
    }
  });

  app.get("/api/reports", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      res.json({ message: "Reports data - admin/manager only", authorized: true });
    } catch (error) {
      console.error("Reports fetch error:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get("/api/dashboard/metrics", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse time range from query parameter (default: 7d)
      const timeRange = (req.query.range as string) || "7d";
      const now = new Date();

      // Calculate days based on range
      let rangeDays: number;
      switch (timeRange) {
        case "7d": rangeDays = 7; break;
        case "14d": rangeDays = 14; break;
        case "30d": rangeDays = 30; break;
        case "90d": rangeDays = 90; break;
        case "ytd": {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          rangeDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
          break;
        }
        default: rangeDays = 7;
      }

      const isPrivileged = currentUser.role === "admin" || currentUser.role === "manager";
      const allLeads = await storage.getAllLeads();
      const allSdrs = await storage.getAllSdrs();
      const allAEs = await storage.getAllAccountExecutives();
      const sdrIds = allSdrs.map(sdr => sdr.id);
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);

      let callSessions;
      if (isPrivileged) {
        const sdrUserIds = sdrUsers.map(u => u.id);
        callSessions = await storage.getCallSessionsByUserIds(sdrUserIds);
      } else {
        callSessions = await storage.getCallSessionsByUser(req.session.userId!);
      }

      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const previousRangeStart = new Date(now.getTime() - (rangeDays * 2) * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const todaySessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= today);
      const rangeSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= rangeStart);
      const previousRangeSessions = callSessions.filter(s => {
        const d = s.startedAt ? new Date(s.startedAt) : null;
        return d && d >= previousRangeStart && d < rangeStart;
      });
      const monthSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= monthAgo);

      const qualifiedInRange = rangeSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
      const qualifiedPrevRange = previousRangeSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
      const meetingsInRange = rangeSessions.filter(s => s.disposition === "meeting-booked");
      const connectedInRange = rangeSessions.filter(s =>
        s.disposition === "connected" || s.disposition === "qualified" ||
        s.disposition === "meeting-booked" || s.disposition === "callback-scheduled"
      );

      const conversionRate = rangeSessions.length > 0
        ? Math.round((qualifiedInRange.length / rangeSessions.length) * 100)
        : 0;
      const lastConversionRate = previousRangeSessions.length > 0
        ? Math.round((qualifiedPrevRange.length / previousRangeSessions.length) * 100)
        : 0;

      const qualifiedLeads = allLeads.filter(l => l.status === "qualified" || l.status === "sent_to_ae");
      const pipelineValue = qualifiedLeads.length * 15000;

      // Generate daily activity based on the selected range
      // For ranges > 30 days, aggregate by week to keep chart readable
      const dailyActivity: { date: string; calls: number; qualified: number }[] = [];
      const useWeeklyAggregation = rangeDays > 30;
      const dataPoints = useWeeklyAggregation ? Math.min(Math.ceil(rangeDays / 7), 13) : Math.min(rangeDays, 30);

      for (let i = dataPoints - 1; i >= 0; i--) {
        if (useWeeklyAggregation) {
          // Aggregate by week
          const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
          const weekSessions = callSessions.filter(s => {
            const d = s.startedAt ? new Date(s.startedAt) : null;
            return d && d >= weekStart && d < weekEnd;
          });
          dailyActivity.push({
            date: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            calls: weekSessions.length,
            qualified: weekSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
          });
        } else {
          // Daily data points
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          const daySessions = callSessions.filter(s => {
            const d = s.startedAt ? new Date(s.startedAt) : null;
            return d && d >= dayStart && d < dayEnd;
          });
          // Use shorter date format for ranges > 7 days
          const dateFormat = rangeDays > 7
            ? { month: "short" as const, day: "numeric" as const }
            : { weekday: "short" as const };
          dailyActivity.push({
            date: dayStart.toLocaleDateString("en-US", dateFormat),
            calls: daySessions.length,
            qualified: daySessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
          });
        }
      }

      const dispositionBreakdown = rangeSessions.reduce((acc, s) => {
        const disp = s.disposition || "no-answer";
        acc[disp] = (acc[disp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const funnel = {
        totalCalls: rangeSessions.length,
        connected: connectedInRange.length,
        qualified: qualifiedInRange.length,
        meetings: meetingsInRange.length,
      };

      let sdrLeaderboard: Array<{
        sdrId: string;
        sdrName: string;
        userId: string | null;
        calls: number;
        qualified: number;
        meetings: number;
        connectRate: number;
        talkTimeMinutes: number;
      }> = [];

      if (isPrivileged) {
        sdrLeaderboard = allSdrs.map(sdr => {
          const sdrUser = sdrUsers.find(u => u.sdrId === sdr.id);
          const sdrSessions = sdrUser ? rangeSessions.filter(s => s.userId === sdrUser.id) : [];
          const completed = sdrSessions.filter(s => s.status === "completed");
          const connected = sdrSessions.filter(s =>
            s.disposition === "connected" || s.disposition === "qualified" ||
            s.disposition === "meeting-booked" || s.disposition === "callback-scheduled"
          );
          return {
            sdrId: sdr.id,
            sdrName: sdr.name,
            userId: sdrUser?.id || null,
            calls: sdrSessions.length,
            qualified: sdrSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
            meetings: sdrSessions.filter(s => s.disposition === "meeting-booked").length,
            connectRate: sdrSessions.length > 0 ? Math.round((connected.length / sdrSessions.length) * 100) : 0,
            talkTimeMinutes: Math.round(completed.reduce((sum, s) => sum + (s.duration || 0), 0) / 60),
          };
        }).sort((a, b) => b.qualified - a.qualified || b.meetings - a.meetings);
      }

      const callsNeedingAnalysis = callSessions.filter(s => 
        s.status === "completed" && !s.coachingNotes && s.transcriptText
      ).slice(0, 10);

      const hotLeads = allLeads.filter(l =>
        l.status === "qualified" || l.status === "sent_to_ae"
      ).slice(0, 5);

      // Optimized: Use single query instead of N+1 pattern
      const allLeadsWithResearch = await storage.getAllLeadsWithResearch();
      const leadsWithoutResearch = allLeadsWithResearch
        .filter(l => !l.hasResearch)
        .slice(0, 5);

      const roiTracking = await (async () => {
        let callsWithPrep = 0;
        let callsWithoutPrep = 0;
        let meetingsWithPrep = 0;
        let meetingsWithoutPrep = 0;

        for (const session of rangeSessions) {
          if (!session.leadId) {
            callsWithoutPrep++;
            if (session.disposition === "meeting-booked") {
              meetingsWithoutPrep++;
            }
            continue;
          }

          const researchPacket = await storage.getResearchPacketByLead(session.leadId);
          const hadResearch = researchPacket && researchPacket.createdAt && session.startedAt &&
            new Date(researchPacket.createdAt) < new Date(session.startedAt);

          if (hadResearch) {
            callsWithPrep++;
            if (session.disposition === "meeting-booked") {
              meetingsWithPrep++;
            }
          } else {
            callsWithoutPrep++;
            if (session.disposition === "meeting-booked") {
              meetingsWithoutPrep++;
            }
          }
        }

        return { callsWithPrep, callsWithoutPrep, meetingsWithPrep, meetingsWithoutPrep };
      })();

      // Generate sparkline data for hero metrics (last 7 periods)
      const sparklinePoints = 7;
      const periodLength = Math.ceil(rangeDays / sparklinePoints);

      const sparklines = {
        calls: [] as number[],
        qualified: [] as number[],
        meetings: [] as number[],
        conversion: [] as number[],
      };

      for (let i = sparklinePoints - 1; i >= 0; i--) {
        const periodEnd = new Date(now.getTime() - i * periodLength * 24 * 60 * 60 * 1000);
        const periodStart = new Date(periodEnd.getTime() - periodLength * 24 * 60 * 60 * 1000);

        const periodSessions = callSessions.filter(s => {
          const d = s.startedAt ? new Date(s.startedAt) : null;
          return d && d >= periodStart && d < periodEnd;
        });

        const periodQualified = periodSessions.filter(s =>
          s.disposition === "qualified" || s.disposition === "meeting-booked"
        ).length;
        const periodMeetings = periodSessions.filter(s =>
          s.disposition === "meeting-booked"
        ).length;

        sparklines.calls.push(periodSessions.length);
        sparklines.qualified.push(periodQualified);
        sparklines.meetings.push(periodMeetings);
        sparklines.conversion.push(
          periodSessions.length > 0 ? Math.round((periodQualified / periodSessions.length) * 100) : 0
        );
      }

      // Anomaly detection helper function
      function detectAnomaly(values: number[], currentValue: number): { isAnomaly: boolean; type: "spike" | "drop" | null; severity: number } {
        if (values.length < 3) return { isAnomaly: false, type: null, severity: 0 };

        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Avoid false positives when std dev is very small
        if (stdDev < 1) return { isAnomaly: false, type: null, severity: 0 };

        const zScore = (currentValue - mean) / stdDev;
        const isAnomaly = Math.abs(zScore) > 1.5; // 1.5 standard deviations
        const severity = Math.min(Math.abs(zScore) / 3, 1); // Normalize severity 0-1

        return {
          isAnomaly,
          type: isAnomaly ? (zScore > 0 ? "spike" : "drop") : null,
          severity: isAnomaly ? severity : 0,
        };
      }

      // Detect anomalies for each metric
      const anomalies = {
        calls: detectAnomaly(sparklines.calls.slice(0, -1), rangeSessions.length),
        qualified: detectAnomaly(sparklines.qualified.slice(0, -1), qualifiedInRange.length),
        meetings: detectAnomaly(sparklines.meetings.slice(0, -1), meetingsInRange.length),
        conversion: detectAnomaly(sparklines.conversion.slice(0, -1), conversionRate),
      };

      // Goal tracking with predictions
      // Calculate days elapsed and remaining in current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysInMonth = endOfMonth.getDate();
      const daysElapsed = now.getDate();
      const daysRemaining = daysInMonth - daysElapsed;

      // Get current month's sessions for goal tracking
      const currentMonthSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= startOfMonth);
      const currentMonthQualified = currentMonthSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
      const currentMonthMeetings = currentMonthSessions.filter(s => s.disposition === "meeting-booked");

      // Define monthly goals (could be stored per-user in the future)
      const monthlyGoals = {
        calls: isPrivileged ? allSdrs.length * 200 : 200, // 200 calls per SDR per month
        qualified: isPrivileged ? allSdrs.length * 20 : 20, // 20 qualified leads per SDR
        meetings: isPrivileged ? allSdrs.length * 8 : 8, // 8 meetings per SDR
      };

      // Calculate projections based on current pace
      const dailyRate = {
        calls: daysElapsed > 0 ? currentMonthSessions.length / daysElapsed : 0,
        qualified: daysElapsed > 0 ? currentMonthQualified.length / daysElapsed : 0,
        meetings: daysElapsed > 0 ? currentMonthMeetings.length / daysElapsed : 0,
      };

      const projectedMonth = {
        calls: Math.round(currentMonthSessions.length + (dailyRate.calls * daysRemaining)),
        qualified: Math.round(currentMonthQualified.length + (dailyRate.qualified * daysRemaining)),
        meetings: Math.round(currentMonthMeetings.length + (dailyRate.meetings * daysRemaining)),
      };

      const goalTracking = {
        daysRemaining,
        daysElapsed,
        metrics: {
          calls: {
            current: currentMonthSessions.length,
            goal: monthlyGoals.calls,
            projected: projectedMonth.calls,
            dailyRate: Math.round(dailyRate.calls * 10) / 10,
          },
          qualified: {
            current: currentMonthQualified.length,
            goal: monthlyGoals.qualified,
            projected: projectedMonth.qualified,
            dailyRate: Math.round(dailyRate.qualified * 10) / 10,
          },
          meetings: {
            current: currentMonthMeetings.length,
            goal: monthlyGoals.meetings,
            projected: projectedMonth.meetings,
            dailyRate: Math.round(dailyRate.meetings * 10) / 10,
          },
        },
      };

      res.json({
        hero: {
          pipelineValue,
          pipelineLeads: qualifiedLeads.length,
          conversionRate,
          conversionTrend: conversionRate - lastConversionRate,
          callsToday: todaySessions.length,
          callsInRange: rangeSessions.length,
          callsTrend: previousRangeSessions.length > 0
            ? Math.round(((rangeSessions.length - previousRangeSessions.length) / previousRangeSessions.length) * 100)
            : rangeSessions.length > 0 ? 100 : 0,
          meetingsBooked: meetingsInRange.length,
          qualifiedLeads: qualifiedInRange.length,
          sparklines,
          anomalies,
        },
        timeRange,
        rangeDays,
        funnel,
        dispositionBreakdown,
        dailyActivity,
        sdrLeaderboard: sdrLeaderboard.slice(0, 10),
        actionItems: {
          callsNeedingAnalysis: callsNeedingAnalysis.map(c => ({
            id: c.id,
            toNumber: c.toNumber,
            duration: c.duration,
            startedAt: c.startedAt,
          })),
          hotLeads: hotLeads.map(l => ({
            id: l.id,
            companyName: l.companyName,
            contactName: l.contactName,
            phone: l.contactPhone,
          })),
          leadsWithoutResearch: leadsWithoutResearch.map(l => ({
            id: l.id,
            companyName: l.companyName,
            contactName: l.contactName,
          })),
        },
        teamSize: {
          sdrs: allSdrs.length,
          aes: allAEs.length,
          leads: allLeads.length,
        },
        roiTracking,
        goalTracking,
        isPrivileged,
        currentUserId: req.session.userId,
      });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Drill-down endpoint for chart interactions
  app.get("/api/dashboard/drilldown", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      const { type, filter, range } = req.query as { type: string; filter: string; range: string };
      const timeRange = range || "7d";
      const now = new Date();

      let rangeDays: number;
      switch (timeRange) {
        case "7d": rangeDays = 7; break;
        case "14d": rangeDays = 14; break;
        case "30d": rangeDays = 30; break;
        case "90d": rangeDays = 90; break;
        case "ytd": {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          rangeDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
          break;
        }
        default: rangeDays = 7;
      }

      const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const isPrivileged = currentUser.role === "admin" || currentUser.role === "manager";

      const allSdrs = await storage.getAllSdrs();
      const sdrIds = allSdrs.map(sdr => sdr.id);
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);

      let callSessions;
      if (isPrivileged) {
        const sdrUserIds = sdrUsers.map(u => u.id);
        callSessions = await storage.getCallSessionsByUserIds(sdrUserIds);
      } else {
        callSessions = await storage.getCallSessionsByUser(req.session.userId!);
      }

      const rangeSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= rangeStart);

      // Filter based on type and filter value
      let filteredSessions = rangeSessions;
      if (type === "disposition") {
        filteredSessions = rangeSessions.filter(s => s.disposition === filter);
      } else if (type === "funnel") {
        // Funnel stages: total, connected, qualified, meetings
        switch (filter) {
          case "total":
            filteredSessions = rangeSessions;
            break;
          case "connected":
            filteredSessions = rangeSessions.filter(s =>
              s.disposition === "connected" || s.disposition === "qualified" ||
              s.disposition === "meeting-booked" || s.disposition === "callback-scheduled"
            );
            break;
          case "qualified":
            filteredSessions = rangeSessions.filter(s =>
              s.disposition === "qualified" || s.disposition === "meeting-booked"
            );
            break;
          case "meetings":
            filteredSessions = rangeSessions.filter(s => s.disposition === "meeting-booked");
            break;
        }
      }

      // Get lead info for each session
      const allLeads = await storage.getAllLeads();
      const leadMap = new Map(allLeads.map(l => [l.id, l]));

      const calls = filteredSessions.slice(0, 50).map(session => {
        const lead = session.leadId ? leadMap.get(session.leadId) : null;
        return {
          id: session.id,
          leadId: session.leadId,
          companyName: lead?.companyName || null,
          contactName: lead?.contactName || null,
          toNumber: session.toNumber || "",
          disposition: session.disposition || "unknown",
          duration: session.duration,
          startedAt: session.startedAt,
        };
      }).sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());

      res.json({
        calls,
        total: filteredSessions.length,
        filter,
      });
    } catch (error) {
      console.error("Drill-down error:", error);
      res.status(500).json({ message: "Failed to fetch drill-down data" });
    }
  });

  // AI-powered dashboard insights
  app.get("/api/dashboard/insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      const timeRange = (req.query.range as string) || "7d";
      const now = new Date();

      let rangeDays: number;
      switch (timeRange) {
        case "7d": rangeDays = 7; break;
        case "14d": rangeDays = 14; break;
        case "30d": rangeDays = 30; break;
        case "90d": rangeDays = 90; break;
        case "ytd": {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          rangeDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
          break;
        }
        default: rangeDays = 7;
      }

      const isPrivileged = currentUser.role === "admin" || currentUser.role === "manager";
      const allSdrs = await storage.getAllSdrs();
      const sdrIds = allSdrs.map(sdr => sdr.id);
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);

      let callSessions;
      if (isPrivileged) {
        const sdrUserIds = sdrUsers.map(u => u.id);
        callSessions = await storage.getCallSessionsByUserIds(sdrUserIds);
      } else {
        callSessions = await storage.getCallSessionsByUser(req.session.userId!);
      }

      const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const previousRangeStart = new Date(now.getTime() - (rangeDays * 2) * 24 * 60 * 60 * 1000);

      const rangeSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= rangeStart);
      const previousRangeSessions = callSessions.filter(s => {
        const d = s.startedAt ? new Date(s.startedAt) : null;
        return d && d >= previousRangeStart && d < rangeStart;
      });

      const qualifiedInRange = rangeSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
      const qualifiedPrevRange = previousRangeSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
      const meetingsInRange = rangeSessions.filter(s => s.disposition === "meeting-booked");
      const meetingsPrevRange = previousRangeSessions.filter(s => s.disposition === "meeting-booked");
      const connectedInRange = rangeSessions.filter(s =>
        s.disposition === "connected" || s.disposition === "qualified" ||
        s.disposition === "meeting-booked" || s.disposition === "callback-scheduled"
      );

      const conversionRate = rangeSessions.length > 0
        ? Math.round((qualifiedInRange.length / rangeSessions.length) * 100)
        : 0;
      const previousConversionRate = previousRangeSessions.length > 0
        ? Math.round((qualifiedPrevRange.length / previousRangeSessions.length) * 100)
        : 0;
      const connectRate = rangeSessions.length > 0
        ? Math.round((connectedInRange.length / rangeSessions.length) * 100)
        : 0;

      // Generate daily activity for analysis
      const dailyActivity: Array<{ date: string; calls: number; qualified: number }> = [];
      const dataPoints = Math.min(rangeDays, 14);
      for (let i = dataPoints - 1; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const daySessions = callSessions.filter(s => {
          const d = s.startedAt ? new Date(s.startedAt) : null;
          return d && d >= dayStart && d < dayEnd;
        });
        dailyActivity.push({
          date: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
          calls: daySessions.length,
          qualified: daySessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
        });
      }

      const dispositionBreakdown = rangeSessions.reduce((acc, s) => {
        const disp = s.disposition || "no-answer";
        acc[disp] = (acc[disp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Import and use the AI insights generator
      const { generateDashboardInsights } = await import("./ai/dashboardInsights.js");

      const insights = await generateDashboardInsights({
        callsInRange: rangeSessions.length,
        previousCalls: previousRangeSessions.length,
        qualifiedLeads: qualifiedInRange.length,
        previousQualified: qualifiedPrevRange.length,
        meetingsBooked: meetingsInRange.length,
        previousMeetings: meetingsPrevRange.length,
        conversionRate,
        previousConversionRate,
        connectRate,
        dailyActivity,
        dispositionBreakdown,
        topPerformingDays: dailyActivity.sort((a, b) => b.qualified - a.qualified).slice(0, 3).map(d => d.date),
        lowPerformingDays: dailyActivity.sort((a, b) => a.calls - b.calls).slice(0, 3).map(d => d.date),
        teamSize: isPrivileged ? allSdrs.length : 1,
        isManager: isPrivileged,
      });

      res.json({ insights, timeRange, generatedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Dashboard insights error:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  app.get("/api/manager/oversight", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const allSdrs = await storage.getAllSdrs();
      const sdrIds = allSdrs.map(sdr => sdr.id);
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);
      const sdrUserIds = sdrUsers.map(u => u.id);
      
      const callSessions = await storage.getCallSessionsByUserIds(sdrUserIds);
      
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const weekSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= weekAgo);
      const monthSessions = callSessions.filter(s => s.startedAt && new Date(s.startedAt) >= monthAgo);

      const sdrPerformance = allSdrs.map(sdr => {
        const sdrUser = sdrUsers.find(u => u.sdrId === sdr.id);
        const sdrSessions = sdrUser ? weekSessions.filter(s => s.userId === sdrUser.id) : [];
        const completedCalls = sdrSessions.filter(s => s.status === "completed");
        const totalTalkTime = completedCalls.reduce((sum, s) => sum + (s.duration || 0), 0);
        
        const qualifiedCalls = sdrSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked");
        const connectedCalls = sdrSessions.filter(s => s.disposition === "connected" || s.disposition === "qualified" || s.disposition === "meeting-booked");

        return {
          sdrId: sdr.id,
          sdrName: sdr.name,
          userId: sdrUser?.id || null,
          totalCalls: sdrSessions.length,
          completedCalls: completedCalls.length,
          totalTalkTimeMinutes: Math.round(totalTalkTime / 60),
          avgCallDuration: completedCalls.length > 0 ? Math.round(totalTalkTime / completedCalls.length / 60) : 0,
          qualifiedLeads: qualifiedCalls.length,
          connectRate: sdrSessions.length > 0 ? Math.round((connectedCalls.length / sdrSessions.length) * 100) : 0,
          meetingsBooked: sdrSessions.filter(s => s.disposition === "meeting-booked").length,
        };
      });

      const dispositionBreakdown = weekSessions.reduce((acc, s) => {
        const disp = s.disposition || "unknown";
        acc[disp] = (acc[disp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const toolUsageAccountability = await (async () => {
        let callsWithPrep = 0;
        let callsWithoutPrep = 0;
        let meetingsWithPrep = 0;
        let meetingsWithoutPrep = 0;
        let connectedWithPrep = 0;
        let connectedWithoutPrep = 0;
        
        for (const session of weekSessions) {
          const connected = session.disposition === "connected" || 
            session.disposition === "qualified" || 
            session.disposition === "meeting-booked" ||
            session.disposition === "callback-scheduled";
          const isMeeting = session.disposition === "meeting-booked";
          
          if (!session.leadId) {
            callsWithoutPrep++;
            if (isMeeting) meetingsWithoutPrep++;
            if (connected) connectedWithoutPrep++;
            continue;
          }
          
          const researchPacket = await storage.getResearchPacketByLead(session.leadId);
          const hadResearch = researchPacket && researchPacket.createdAt && session.startedAt &&
            new Date(researchPacket.createdAt) < new Date(session.startedAt);
          
          if (hadResearch) {
            callsWithPrep++;
            if (isMeeting) meetingsWithPrep++;
            if (connected) connectedWithPrep++;
          } else {
            callsWithoutPrep++;
            if (isMeeting) meetingsWithoutPrep++;
            if (connected) connectedWithoutPrep++;
          }
        }
        
        const connectRateWithPrep = callsWithPrep > 0 
          ? Math.round((connectedWithPrep / callsWithPrep) * 100) : 0;
        const connectRateWithoutPrep = callsWithoutPrep > 0 
          ? Math.round((connectedWithoutPrep / callsWithoutPrep) * 100) : 0;
        const meetingRateWithPrep = callsWithPrep > 0 
          ? Math.round((meetingsWithPrep / callsWithPrep) * 100) : 0;
        const meetingRateWithoutPrep = callsWithoutPrep > 0 
          ? Math.round((meetingsWithoutPrep / callsWithoutPrep) * 100) : 0;
        
        const connectRateImprovement = connectRateWithoutPrep > 0 
          ? Math.round(((connectRateWithPrep - connectRateWithoutPrep) / connectRateWithoutPrep) * 100) : 0;
        const meetingRateImprovement = meetingRateWithoutPrep > 0 
          ? Math.round(((meetingRateWithPrep - meetingRateWithoutPrep) / meetingRateWithoutPrep) * 100) : 0;
        
        return {
          callsWithPrep,
          callsWithoutPrep,
          meetingsWithPrep,
          meetingsWithoutPrep,
          connectRateWithPrep,
          connectRateWithoutPrep,
          meetingRateWithPrep,
          meetingRateWithoutPrep,
          connectRateImprovement,
          meetingRateImprovement,
        };
      })();

      res.json({
        weeklyStats: {
          totalCalls: weekSessions.length,
          completedCalls: weekSessions.filter(s => s.status === "completed").length,
          totalTalkTimeMinutes: Math.round(weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60),
          meetingsBooked: weekSessions.filter(s => s.disposition === "meeting-booked").length,
          qualifiedLeads: weekSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
        },
        monthlyStats: {
          totalCalls: monthSessions.length,
          completedCalls: monthSessions.filter(s => s.status === "completed").length,
          totalTalkTimeMinutes: Math.round(monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60),
          meetingsBooked: monthSessions.filter(s => s.disposition === "meeting-booked").length,
          qualifiedLeads: monthSessions.filter(s => s.disposition === "qualified" || s.disposition === "meeting-booked").length,
        },
        sdrPerformance,
        dispositionBreakdown,
        toolUsageAccountability,
        recentCalls: callSessions.slice(0, 50),
      });
    } catch (error) {
      console.error("Manager oversight fetch error:", error);
      res.status(500).json({ message: "Failed to fetch oversight data" });
    }
  });

  app.get("/api/manager/call-review/:callId", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { callId } = req.params;
      const callSession = await storage.getCallSession(callId);
      
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      const lead = callSession.leadId ? await storage.getLead(callSession.leadId) : null;
      const caller = await storage.getUser(callSession.userId);

      res.json({
        callSession,
        lead,
        caller: caller ? { id: caller.id, name: caller.name, email: caller.email, role: caller.role } : null,
      });
    } catch (error) {
      console.error("Call review fetch error:", error);
      res.status(500).json({ message: "Failed to fetch call review data" });
    }
  });

  app.patch("/api/manager/call-review/:callId/notes", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { callId } = req.params;

      // Validate request body
      const validatedData = updateManagerNotesSchema.parse(req.body);

      const callSession = await storage.getCallSession(callId);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      const updated = await storage.updateCallSession(callId, {
        managerSummary: validatedData.managerSummary || callSession.managerSummary,
        coachingNotes: validatedData.coachingNotes || callSession.coachingNotes,
        sentimentScore: validatedData.sentimentScore || callSession.sentimentScore,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Manager notes update error:", error);
      res.status(500).json({ message: "Failed to update manager notes" });
    }
  });

  app.get("/api/manager/coaching-effectiveness", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const tipsByType = await storage.getAllCoachingTips();
      const recentTips = await storage.getRecentCoachingTips(100);
      
      const callSessions = await storage.getAllCallSessions();
      const callsWithReview = callSessions.filter(s => s.managerSummary || s.sentimentScore);
      const avgSentiment = callsWithReview.length > 0 
        ? callsWithReview.reduce((sum, s) => sum + (s.sentimentScore || 0), 0) / callsWithReview.length 
        : 0;

      const qualityTrend = callSessions
        .filter(s => s.sentimentScore && s.startedAt)
        .sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())
        .slice(0, 20)
        .map(s => ({
          date: s.startedAt,
          score: s.sentimentScore,
        }));

      res.json({
        tipsByType,
        totalTipsGenerated: tipsByType.reduce((sum, t) => sum + t.count, 0),
        recentTips: recentTips.slice(0, 20),
        callsReviewed: callsWithReview.length,
        averageSentiment: Math.round(avgSentiment * 10) / 10,
        qualityTrend,
      });
    } catch (error) {
      console.error("Coaching effectiveness fetch error:", error);
      res.status(500).json({ message: "Failed to fetch coaching effectiveness data" });
    }
  });

  // Debug endpoint to test Drive connection (temporary)
  app.get("/api/debug/scan-drive", async (req: Request, res: Response) => {
    try {
      console.log("[Debug] Testing Google Drive connection...");
      const files = await listFilesInProcessed();
      console.log(`[Debug] Found ${files.length} files`);
      
      const sdrIdSet = new Set<string>();
      for (const file of files) {
        // Pattern: SDR_ID + 10 digits (YYMMDDHHMM) + "Call" or "call"
        const match = file.name.match(/^([A-Z]{2,10})\d{10}[Cc]all/i);
        if (match) {
          sdrIdSet.add(match[1].toUpperCase());
        }
      }
      
      res.json({
        success: true,
        totalFiles: files.length,
        uniqueSdrIds: Array.from(sdrIdSet),
        sampleFiles: files.slice(0, 10).map(f => f.name),
      });
    } catch (error: any) {
      console.error("[Debug] Drive error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/scan-processed-folder", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const files = await listFilesInProcessed();
      
      const sdrIdSet = new Set<string>();
      const sdrIdNameMap: Record<string, string> = {};
      
      for (const file of files) {
        // Pattern: SDR_ID + 10 digits (YYMMDDHHMM) + "Call" or "call"
        const match = file.name.match(/^([A-Z]{2,10})\d{10}[Cc]all/i);
        if (match) {
          const sdrId = match[1].toUpperCase();
          sdrIdSet.add(sdrId);
          sdrIdNameMap[sdrId] = sdrId;
        }
      }
      
      res.json({
        totalFiles: files.length,
        uniqueSdrIds: Array.from(sdrIdSet),
        sdrIdNameMap,
        sampleFiles: files.slice(0, 20).map(f => f.name),
      });
    } catch (error) {
      console.error("Scan processed folder error:", error);
      res.status(500).json({ message: "Failed to scan processed folder" });
    }
  });

  app.post("/api/admin/populate-sdrs", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      console.log("[Populate SDRs] Starting SDR population...");
      
      const existingManagers = await storage.getAllManagers();
      const existingSdrs = await storage.getAllSdrs();
      console.log(`[Populate SDRs] Found ${existingManagers.length} existing managers, ${existingSdrs.length} existing SDRs`);
      
      const managersCreated: string[] = [];
      const sdrsCreated: string[] = [];
      
      const managerData = [
        { name: "Juan Roldan", email: "juan@groundgamesales.com" },
        { name: "Roland Valles", email: "main@dehyl.ca" },
      ];
      
      const managerMap: Record<string, string> = {};
      
      for (const mgr of managerData) {
        const existing = existingManagers.find(m => m.email === mgr.email);
        if (existing) {
          managerMap[mgr.email] = existing.id;
          console.log(`[Populate SDRs] Manager ${mgr.name} already exists with ID: ${existing.id}`);
        } else {
          const created = await storage.createManager({
            name: mgr.name,
            email: mgr.email,
            isActive: true,
          });
          managerMap[mgr.email] = created.id;
          managersCreated.push(mgr.name);
          console.log(`[Populate SDRs] Created manager ${mgr.name} with ID: ${created.id}`);
        }
      }
      
      console.log("[Populate SDRs] Fetching files from Google Drive Processed folder...");
      const files = await listFilesInProcessed();
      console.log(`[Populate SDRs] Found ${files.length} files in Processed folder`);
      
      if (files.length > 0) {
        console.log(`[Populate SDRs] Sample files: ${files.slice(0, 5).map(f => f.name).join(", ")}`);
      }
      
      const sdrIdSet = new Set<string>();
      
      for (const file of files) {
        // Pattern: SDR_ID + 10 digits (YYMMDDHHMM) + "Call" or "call"
        const match = file.name.match(/^([A-Z]{2,10})\d{10}[Cc]all/i);
        if (match) {
          sdrIdSet.add(match[1].toUpperCase());
        }
      }
      
      console.log(`[Populate SDRs] Extracted ${sdrIdSet.size} unique SDR IDs: ${Array.from(sdrIdSet).join(", ")}`);
      
      // Map known SDR IDs to their full names
      const sdrInfoMap: Record<string, { name: string; managerEmail: string; email: string; gender: string }> = {};
      
      const managerEmails = managerData.map(m => m.email);
      const sdrIds = Array.from(sdrIdSet);
      let managerIndex = 0;
      
      for (const sdrId of sdrIds) {
        const existing = existingSdrs.find(s => s.id === sdrId);
        if (existing) {
          console.log(`[Populate SDRs] SDR ${sdrId} already exists, skipping`);
          continue;
        }
        
        const info = sdrInfoMap[sdrId];
        const managerEmail = info?.managerEmail || managerEmails[managerIndex % managerEmails.length];
        const managerId = managerMap[managerEmail];
        
        if (!managerId) {
          console.log(`[Populate SDRs] No manager ID for ${managerEmail}, skipping SDR ${sdrId}`);
          continue;
        }
        
        await storage.createSdr({
          id: sdrId,
          name: info?.name || sdrId,
          email: info?.email || `${sdrId.toLowerCase()}@company.com`,
          managerEmail: managerEmail,
          managerId: managerId,
          gender: info?.gender || "neutral",
          timezone: "America/Chicago",
          isActive: true,
        });
        
        console.log(`[Populate SDRs] Created SDR ${sdrId} -> ${info?.name || sdrId} under manager ${managerEmail}`);
        sdrsCreated.push(sdrId);
        managerIndex++;
      }
      
      console.log(`[Populate SDRs] Complete. Created ${managersCreated.length} managers and ${sdrsCreated.length} SDRs`);
      
      res.json({
        managersCreated,
        sdrsCreated,
        totalManagers: Object.keys(managerMap).length,
        totalSdrs: sdrsCreated.length,
      });
    } catch (error) {
      console.error("Populate SDRs error:", error);
      res.status(500).json({ message: "Failed to populate SDRs" });
    }
  });

  app.post("/api/call-sessions/zoom", requireAuth, async (req: Request, res: Response) => {
    try {
      const zoomSessionSchema = z.object({
        zoomCallId: z.string().min(1, "Zoom call ID required"),
        direction: z.enum(["inbound", "outbound"]),
        toNumber: z.string().optional(),
        fromNumber: z.string().optional(),
        leadId: z.string().uuid().optional().nullable(),
      });

      const parsed = zoomSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const { zoomCallId, direction, toNumber, fromNumber, leadId } = parsed.data;
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = await storage.createCallSession({
        callSid: `zoom_${zoomCallId}`,
        userId: req.session.userId!,
        leadId: leadId || null,
        direction,
        fromNumber: fromNumber || user.email || "unknown",
        toNumber: toNumber || "unknown",
        status: "initiated",
      });

      console.log(`[ZoomPhone] Created call session ${session.id} for Zoom call ${zoomCallId}`);
      res.json({ sessionId: session.id, zoomCallId });
    } catch (error) {
      console.error("Zoom call session creation error:", error);
      res.status(500).json({ message: "Failed to create call session" });
    }
  });

  app.get("/api/call-sessions/by-zoom-id/:zoomCallId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zoomCallId } = req.params;
      const callSid = `zoom_${zoomCallId}`;
      const session = await storage.getCallSessionByCallSid(callSid);
      if (!session) {
        return res.status(404).json({ message: "Zoom call session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Zoom call session lookup error:", error);
      res.status(500).json({ message: "Failed to find call session" });
    }
  });

  app.patch("/api/call-sessions/zoom/:zoomCallId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zoomCallId } = req.params;
      const updateSchema = z.object({
        status: z.string().optional(),
        duration: z.number().optional(),
        recordingUrl: z.string().optional(),
        transcriptText: z.string().optional(),
        zoomAiSummary: z.string().optional(),
        direction: z.string().optional(),
        toNumber: z.string().optional(),
        fromNumber: z.string().optional(),
        leadId: z.string().uuid().optional().nullable(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.flatten() });
      }

      const callSid = `zoom_${zoomCallId}`;
      let session = await storage.getCallSessionByCallSid(callSid);
      
      if (!session) {
        const user = await storage.getUser(req.session.userId!);
        session = await storage.createCallSession({
          callSid,
          userId: req.session.userId!,
          leadId: parsed.data.leadId || null,
          direction: parsed.data.direction || "outbound",
          fromNumber: parsed.data.fromNumber || user?.email || "unknown",
          toNumber: parsed.data.toNumber || "unknown",
          status: parsed.data.status || "initiated",
        });
        console.log(`[ZoomPhone] Created session ${session.id} via PATCH for Zoom call ${zoomCallId}`);
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.status) updates.status = parsed.data.status;
      if (parsed.data.duration) updates.duration = parsed.data.duration;
      if (parsed.data.recordingUrl) updates.recordingUrl = parsed.data.recordingUrl;
      if (parsed.data.transcriptText) updates.transcriptText = parsed.data.transcriptText;
      if (parsed.data.zoomAiSummary) updates.coachingNotes = parsed.data.zoomAiSummary;

      if (Object.keys(updates).length > 0) {
        session = await storage.updateCallSession(session.id, updates) || session;
      }
      console.log(`[ZoomPhone] Updated call session ${session.id} for Zoom call ${zoomCallId}`);
      res.json(session);
    } catch (error) {
      console.error("Zoom call session update error:", error);
      res.status(500).json({ message: "Failed to update call session" });
    }
  });

  app.post("/api/call-sessions/zoom/:zoomCallId/auto-analyze", requireAuth, async (req: Request, res: Response) => {
    try {
      const { zoomCallId } = req.params;
      const callSid = `zoom_${zoomCallId}`;
      
      const session = await storage.getCallSessionByCallSid(callSid);
      if (!session) {
        return res.status(404).json({ message: "Call session not found" });
      }

      if (session.userId !== req.session.userId) {
        const requestingUser = await storage.getUser(req.session.userId!);
        if (!requestingUser || (requestingUser.role !== "admin" && requestingUser.role !== "manager")) {
          return res.status(403).json({ message: "You can only analyze your own calls" });
        }
      }

      if (session.coachingNotes && session.transcriptText) {
        console.log(`[AutoAnalysis] Session ${session.id} already analyzed, skipping`);
        return res.json({ status: "already_analyzed", sessionId: session.id });
      }

      console.log(`[AutoAnalysis] Starting automatic analysis for session ${session.id}`);
      
      let transcript = session.transcriptText;
      
      if (!transcript) {
        try {
          const { downloadTranscript, findRecordingByCallId, downloadRecording } = await import("./ai/zoomClient");
          const user = await storage.getUser(session.userId);
          
          if (user?.email) {
            const recording = await findRecordingByCallId(user.email, zoomCallId);
            if (recording?.id) {
              console.log(`[AutoAnalysis] Found Zoom recording ${recording.id}`);
              
              transcript = await downloadTranscript(recording.id);
              if (transcript) {
                await storage.updateCallSession(session.id, { transcriptText: transcript });
                console.log(`[AutoAnalysis] Got transcript from Zoom API`);
              } else {
                console.log(`[AutoAnalysis] No Zoom transcript, trying audio transcription`);
                const audioBuffer = await downloadRecording(recording.id);
                if (audioBuffer && audioBuffer.length > 0) {
                  const { transcribeAudio } = await import("./ai/transcribe");
                  transcript = await transcribeAudio(audioBuffer, "audio/mp3");
                  if (transcript) {
                    await storage.updateCallSession(session.id, { transcriptText: transcript });
                    console.log(`[AutoAnalysis] Transcribed audio with Gemini`);
                  }
                }
              }
            }
          }
        } catch (zoomError) {
          console.error("[AutoAnalysis] Zoom API error:", zoomError);
        }
      }

      if (!transcript && session.recordingUrl) {
        console.log(`[AutoAnalysis] Trying to transcribe from recording URL`);
        try {
          const { transcribeAudio } = await import("./ai/transcribe");
          const audioResponse = await fetch(session.recordingUrl);
          if (audioResponse.ok) {
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            transcript = await transcribeAudio(audioBuffer, "audio/mp3");
            if (transcript) {
              await storage.updateCallSession(session.id, { transcriptText: transcript });
              console.log(`[AutoAnalysis] Transcribed from recording URL`);
            }
          }
        } catch (transcribeError) {
          console.error("[AutoAnalysis] Recording transcription error:", transcribeError);
        }
      }

      if (!transcript || transcript.trim().length < 50) {
        console.log(`[AutoAnalysis] No sufficient transcript for session ${session.id}`);
        return res.json({ 
          status: "pending", 
          message: "Transcript not yet available. Recording may still be processing.",
          sessionId: session.id 
        });
      }

      let leadContext = undefined;
      if (session.leadId) {
        const lead = await storage.getLead(session.leadId);
        if (lead) {
          leadContext = {
            companyName: lead.companyName,
            contactName: lead.contactName,
            industry: lead.companyIndustry || undefined,
          };
        }
      }

      console.log(`[AutoAnalysis] Running Claude coaching analysis...`);
      const { analyzeCallTranscript } = await import("./ai/callCoachingAnalysis");
      const claudeAnalysis = await analyzeCallTranscript(transcript, leadContext);
      
      await storage.updateCallSession(session.id, {
        coachingNotes: JSON.stringify(claudeAnalysis),
      });
      console.log(`[AutoAnalysis] Claude analysis complete, score: ${claudeAnalysis.overallScore}`);

      const user = await storage.getUser(session.userId);
      let sdr = null;
      if (user?.sdrId) {
        sdr = await storage.getSdr(user.sdrId);
      }
      
      const sdrInfo = sdr || {
        id: user?.id || session.userId,
        name: user?.name || "Unknown",
        email: user?.email || "unknown@example.com",
        phone: null,
        managerId: null,
        region: "Unknown",
        createdAt: new Date(),
        managerEmail: "",
        gender: "neutral" as const,
        timezone: null,
        isActive: true,
      };

      console.log(`[AutoAnalysis] Running manager analysis...`);
      const updatedSession = await storage.getCallSession(session.id);
      if (updatedSession) {
        try {
          const { analyzeCallForManager, saveManagerAnalysis } = await import("./ai/managerAnalysis");
          const managerAnalysis = await analyzeCallForManager(updatedSession, sdrInfo);
          await saveManagerAnalysis(updatedSession, sdrInfo, managerAnalysis);
          console.log(`[AutoAnalysis] Manager analysis complete, score: ${managerAnalysis.overallScore}`);
        } catch (managerError) {
          console.error("[AutoAnalysis] Manager analysis error:", managerError);
        }
      }

      try {
        const { processPostCallCoaching } = await import("./ai/coachingAnalysis");
        const sessionWithTranscript = await storage.getCallSession(session.id);
        if (sessionWithTranscript) {
          await processPostCallCoaching(sessionWithTranscript);
          console.log(`[AutoAnalysis] Coaching email processed`);
        }
      } catch (emailError) {
        console.error("[AutoAnalysis] Coaching email error:", emailError);
      }

      res.json({
        status: "completed",
        sessionId: session.id,
        analysis: {
          score: claudeAnalysis.overallScore,
          summary: claudeAnalysis.callSummary,
        },
      });
    } catch (error) {
      console.error("Auto-analysis error:", error);
      res.status(500).json({ message: "Failed to run automatic analysis" });
    }
  });

  app.get("/api/call-sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      let sessions;
      if (user.role === "admin" || user.role === "manager") {
        sessions = await storage.getAllCallSessions();
      } else {
        sessions = await storage.getCallSessionsByUser(req.session.userId!);
      }
      res.json(sessions);
    } catch (error) {
      console.error("Call sessions fetch error:", error);
      res.status(500).json({ message: "Failed to fetch call sessions" });
    }
  });

  app.patch("/api/call-sessions/:id/outcome", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const validatedData = updateCallOutcomeSchema.parse(req.body);

      const session = await storage.getCallSession(id);
      if (!session) {
        return res.status(404).json({ message: "Call session not found" });
      }

      const updated = await storage.updateCallSession(id, {
        disposition: validatedData.disposition,
        keyTakeaways: validatedData.keyTakeaways || null,
        nextSteps: validatedData.nextSteps || null,
        sdrNotes: validatedData.sdrNotes || null,
        callbackDate: validatedData.callbackDate ? new Date(validatedData.callbackDate) : null,
      });

      // Notify connected clients about the call completion
      if (validatedData.disposition && session.userId) {
        notifyCallCompleted(id, session.userId, validatedData.disposition);
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Call outcome update error:", error);
      res.status(500).json({ message: "Failed to update call outcome" });
    }
  });

  // Get AI-suggested disposition for a call session
  app.get("/api/call-sessions/:id/suggested-disposition", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const callSession = await storage.getCallSession(id);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      // Import the suggestion function
      const { suggestCallDisposition } = await import("./ai/dispositionSuggestion.js");

      const suggestion = await suggestCallDisposition({
        duration: callSession.duration,
        transcriptText: callSession.transcriptText,
        status: callSession.status,
      });

      res.json(suggestion);
    } catch (error) {
      console.error("Disposition suggestion error:", error);
      res.status(500).json({
        message: "Failed to generate disposition suggestion",
        // Fallback suggestion
        suggestedDisposition: 'connected',
        confidence: 'low',
        reason: 'Error occurred during suggestion generation'
      });
    }
  });

  // Extract BANT (Budget, Authority, Need, Timeline) from call transcript
  app.post("/api/call-sessions/:id/extract-bant", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const callSession = await storage.getCallSession(id);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      // Import the extraction function
      const { extractBANTFromTranscript } = await import("./ai/bantExtraction.js");

      const bantData = await extractBANTFromTranscript(id);

      res.json({
        success: true,
        data: bantData,
        message: bantData.extractionSummary
      });
    } catch (error) {
      console.error("BANT extraction error:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to extract BANT data"
      });
    }
  });

  app.post("/api/call-sessions/:id/analyze-recording", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const callSession = await storage.getCallSession(id);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      if (callSession.coachingNotes && callSession.transcriptText) {
        return res.json({
          transcript: callSession.transcriptText,
          analysis: JSON.parse(callSession.coachingNotes),
          cached: true,
        });
      }

      let transcript = callSession.transcriptText;
      
      let zoomRecordingId: string | null = null;
      
      if (!transcript && callSession.callSid?.startsWith("zoom_")) {
        const zoomCallId = callSession.callSid.replace("zoom_", "");
        console.log(`[Recording] Fetching Zoom transcript for call ${zoomCallId}`);
        
        try {
          const { downloadTranscript, findRecordingByCallId, downloadRecording } = await import("./ai/zoomClient");
          const user = await storage.getUser(callSession.userId);
          if (user?.email) {
            const recording = await findRecordingByCallId(user.email, zoomCallId);
            if (recording?.id) {
              zoomRecordingId = recording.id;
              transcript = await downloadTranscript(recording.id);
              if (transcript) {
                await storage.updateCallSession(id, { transcriptText: transcript });
                console.log(`[Recording] Saved Zoom transcript for session ${id}`);
              } else {
                console.log(`[Recording] No Zoom transcript, will try audio transcription`);
                const audioBuffer = await downloadRecording(recording.id);
                if (audioBuffer && audioBuffer.length > 0) {
                  const { transcribeAudio } = await import("./ai/transcribe");
                  transcript = await transcribeAudio(audioBuffer, "audio/mp3");
                  if (transcript) {
                    await storage.updateCallSession(id, { transcriptText: transcript });
                    console.log(`[Recording] Transcribed Zoom audio for session ${id}`);
                  }
                }
              }
            } else {
              console.log(`[Recording] No Zoom recording found for call ${zoomCallId}`);
            }
          }
        } catch (zoomError) {
          console.error("[Recording] Zoom API error (credentials may not be configured):", zoomError);
        }
      }

      if (!transcript && callSession.recordingUrl) {
        console.log(`[Recording] Transcribing audio from ${callSession.recordingUrl}`);
        
        try {
          const { transcribeAudio } = await import("./ai/transcribe");
          
          const audioResponse = await fetch(callSession.recordingUrl);
          if (audioResponse.ok) {
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            transcript = await transcribeAudio(audioBuffer, "audio/mp3");
            
            if (transcript) {
              await storage.updateCallSession(id, { transcriptText: transcript });
              console.log(`[Recording] Saved transcription for session ${id}`);
            }
          }
        } catch (transcribeError) {
          console.error("[Recording] Transcription error:", transcribeError);
        }
      }

      if (!transcript) {
        return res.status(400).json({ message: "No transcript available. Recording may still be processing." });
      }

      let leadContext = undefined;
      if (callSession.leadId) {
        const lead = await storage.getLead(callSession.leadId);
        if (lead) {
          leadContext = {
            companyName: lead.companyName,
            contactName: lead.contactName,
            industry: lead.companyIndustry || undefined,
          };
        }
      }

      const { analyzeCallTranscript } = await import("./ai/callCoachingAnalysis");
      const analysis = await analyzeCallTranscript(transcript, leadContext);

      await storage.updateCallSession(id, {
        coachingNotes: JSON.stringify(analysis),
      });

      res.json({
        transcript,
        analysis,
        cached: false,
      });
    } catch (error) {
      console.error("Recording analysis error:", error);
      res.status(500).json({ message: "Failed to analyze recording" });
    }
  });

  app.post("/api/call-sessions/:id/manager-analysis", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const callSession = await storage.getCallSession(id);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      if (!callSession.transcriptText) {
        return res.status(400).json({ message: "No transcript available for analysis" });
      }

      const user = await storage.getUser(callSession.userId);
      if (!user) {
        return res.status(400).json({ message: "User not found for this call" });
      }

      let sdr = null;
      if (user.sdrId) {
        sdr = await storage.getSdr(user.sdrId);
      }
      
      const sdrInfo = sdr || {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: null,
        managerId: null,
        region: "Unknown",
        createdAt: new Date(),
        managerEmail: "",
        gender: "neutral" as const,
        timezone: null,
        isActive: true,
      };

      const existingAnalysis = await storage.getManagerCallAnalysisByCallSession(id);
      if (existingAnalysis) {
        return res.json(existingAnalysis);
      }

      const { analyzeCallForManager, saveManagerAnalysis } = await import("./ai/managerAnalysis");
      const analysis = await analyzeCallForManager(callSession, sdrInfo);
      await saveManagerAnalysis(callSession, sdrInfo, analysis);

      const savedAnalysis = await storage.getManagerCallAnalysisByCallSession(id);
      res.json(savedAnalysis || analysis);
    } catch (error) {
      console.error("Manager analysis error:", error);
      res.status(500).json({ message: "Failed to analyze call for manager" });
    }
  });

  app.get("/api/manager-analyses", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const analyses = await storage.getAllManagerCallAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Manager analyses fetch error:", error);
      res.status(500).json({ message: "Failed to fetch manager analyses" });
    }
  });

  app.get("/api/manager-analyses/:id", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getManagerCallAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Manager analysis fetch error:", error);
      res.status(500).json({ message: "Failed to fetch manager analysis" });
    }
  });

  app.get("/api/call-sessions/:id/manager-analysis", requireRole("admin", "manager"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getManagerCallAnalysisByCallSession(id);
      res.json(analysis || null);
    } catch (error) {
      console.error("Manager analysis fetch by call session error:", error);
      res.status(500).json({ message: "Failed to fetch manager analysis" });
    }
  });

  // Account Executive Routes
  app.get("/api/account-executives", requireAuth, async (req: Request, res: Response) => {
    try {
      const aes = await storage.getAllAccountExecutives();
      res.json(aes);
    } catch (error) {
      console.error("Account executives fetch error:", error);
      res.status(500).json({ message: "Failed to fetch account executives" });
    }
  });

  app.get("/api/account-executives/:id/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const ae = await storage.getAccountExecutive(req.params.id);
      if (!ae) {
        return res.status(404).json({ message: "Account Executive not found" });
      }

      const allLeads = await storage.getAllLeads();
      const aeLeads = allLeads.filter((l: any) => l.assignedAeId === ae.id);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

      const handedOff = aeLeads.filter((l: any) => l.handedOffAt);
      const wonLeads = aeLeads.filter((l: any) => l.status === 'converted');
      const wonThisMonth = wonLeads.filter((l: any) => l.handedOffAt && new Date(l.handedOffAt) >= startOfMonth);
      const wonThisQuarter = wonLeads.filter((l: any) => l.handedOffAt && new Date(l.handedOffAt) >= startOfQuarter);

      const estimatedDealValue = 50000;
      const pipeline = {
        totalDeals: aeLeads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').length,
        totalValue: aeLeads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').length * estimatedDealValue,
        avgDealSize: estimatedDealValue,
        winRate: handedOff.length > 0 ? Math.round((wonLeads.length / handedOff.length) * 100) : 0,
        dealsWonThisMonth: wonThisMonth.length,
        dealsWonThisQuarter: wonThisQuarter.length,
        quotaProgress: ae.quotaAttainment || 0,
        byStage: [
          { stage: 'New', count: aeLeads.filter((l: any) => l.status === 'handed_off').length, value: aeLeads.filter((l: any) => l.status === 'handed_off').length * estimatedDealValue },
          { stage: 'Engaged', count: aeLeads.filter((l: any) => l.status === 'engaged').length, value: aeLeads.filter((l: any) => l.status === 'engaged').length * estimatedDealValue },
          { stage: 'Qualified', count: aeLeads.filter((l: any) => l.status === 'qualified').length, value: aeLeads.filter((l: any) => l.status === 'qualified').length * estimatedDealValue },
          { stage: 'Won', count: wonLeads.length, value: wonLeads.length * estimatedDealValue },
        ],
      };

      const allSdrs = await storage.getAllSdrs();
      const sdrMap = new Map<string, string>();
      for (const s of allSdrs) {
        sdrMap.set(s.id, s.name);
      }

      const recentHandoffs = handedOff
        .sort((a: any, b: any) => new Date(b.handedOffAt).getTime() - new Date(a.handedOffAt).getTime())
        .slice(0, 10)
        .map((lead: any) => ({
          id: lead.id,
          leadName: lead.contactName,
          companyName: lead.companyName,
          sdrName: lead.assignedSdrId ? (sdrMap.get(lead.assignedSdrId) || 'Unknown') : 'Unknown',
          handoffDate: lead.handedOffAt,
          status: lead.status === 'converted' ? 'won' : lead.status === 'lost' ? 'lost' : 'active',
          dealValue: lead.status === 'converted' ? estimatedDealValue : null,
        }));

      const monthlyActivity = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const monthWins = wonLeads.filter((l: any) => {
          const handoff = new Date(l.handedOffAt);
          return handoff >= monthStart && handoff <= monthEnd;
        });
        monthlyActivity.push({
          month: months[d.getMonth()],
          deals: monthWins.length,
          revenue: monthWins.length * estimatedDealValue,
        });
      }

      const achievements = [
        { title: "Pipeline Builder", description: `${pipeline.totalDeals} active opportunities`, icon: "target" },
      ];
      if (wonLeads.length >= 5) {
        achievements.push({ title: "Closer", description: `${wonLeads.length} deals won`, icon: "trophy" });
      }
      if (pipeline.winRate >= 30) {
        achievements.push({ title: "High Converter", description: `${pipeline.winRate}% win rate`, icon: "star" });
      }
      if (wonThisMonth.length >= 2) {
        achievements.push({ title: "Hot Streak", description: `${wonThisMonth.length} deals this month`, icon: "handshake" });
      }

      res.json({
        ae,
        pipeline,
        recentHandoffs,
        monthlyActivity,
        achievements,
      });
    } catch (error) {
      console.error("Get AE profile error:", error);
      res.status(500).json({ message: "Failed to fetch AE profile" });
    }
  });

  app.post("/api/account-executives", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { insertAccountExecutiveSchema } = await import("@shared/schema");
      const parsed = insertAccountExecutiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid account executive data", errors: parsed.error.flatten() });
      }
      const ae = await storage.createAccountExecutive(parsed.data);
      res.status(201).json(ae);
    } catch (error) {
      console.error("Account executive create error:", error);
      res.status(500).json({ message: "Failed to create account executive" });
    }
  });

  app.patch("/api/account-executives/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional().nullable(),
        region: z.string().optional().nullable(),
        specialty: z.string().optional().nullable(),
        isActive: z.boolean().optional()
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", errors: parsed.error.flatten() });
      }
      const updated = await storage.updateAccountExecutive(id, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Account executive not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Account executive update error:", error);
      res.status(500).json({ message: "Failed to update account executive" });
    }
  });

  app.delete("/api/account-executives/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAccountExecutive(id);
      if (!deleted) {
        return res.status(404).json({ message: "Account executive not found" });
      }
      res.json({ message: "Account executive deleted" });
    } catch (error) {
      console.error("Account executive delete error:", error);
      res.status(500).json({ message: "Failed to delete account executive" });
    }
  });

  app.post("/api/call-sessions/:id/send-to-ae", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const sendToAeSchema = z.object({
        aeId: z.string().uuid("Invalid account executive ID"),
        leadId: z.string().uuid("Invalid lead ID").optional()
      });
      const parsed = sendToAeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request data", errors: parsed.error.flatten() });
      }
      const { aeId, leadId } = parsed.data;

      const callSession = await storage.getCallSession(id);
      if (!callSession) {
        return res.status(404).json({ message: "Call session not found" });
      }

      const ae = await storage.getAccountExecutive(aeId);
      if (!ae) {
        return res.status(404).json({ message: "Account executive not found" });
      }

      let lead = null;
      if (leadId) {
        lead = await storage.getLead(leadId);
      }

      const user = await storage.getUser(callSession.userId);
      const sdrName = user?.name || "SDR";

      const { sendFeedbackEmail } = await import("./google/gmailClient");

      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : "https://lead-intel.replit.app";
      const transcriptLink = `${appUrl}/coaching?call=${id}`;

      const callDate = callSession.startedAt ? new Date(callSession.startedAt).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "Recent call";

      const summaryHtml = `
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 20px; }
              .container { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              .header { background-color: #059669; color: #ffffff; padding: 24px 32px; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
              .header .meta { color: #d1fae5; font-size: 14px; margin-top: 8px; }
              .content { padding: 32px; }
              .section { margin-bottom: 24px; }
              .section h3 { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin: 0 0 12px 0; }
              .section p, .section ul { color: #374151; font-size: 15px; margin: 0; }
              .section ul { padding-left: 20px; }
              .section li { margin-bottom: 8px; }
              .cta { display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
              .footer { padding: 20px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
              .footer p { margin: 0; font-size: 12px; color: #9ca3af; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lead Handoff - ${lead?.companyName || "Qualified Lead"}</h1>
                <div class="meta">From ${sdrName} - ${callDate}</div>
              </div>
              
              <div class="content">
                ${lead ? `
                <div class="section">
                  <h3>Lead Information</h3>
                  <p><strong>Company:</strong> ${lead.companyName}</p>
                  <p><strong>Contact:</strong> ${lead.contactName}</p>
                  ${lead.contactTitle ? `<p><strong>Title:</strong> ${lead.contactTitle}</p>` : ""}
                  <p><strong>Email:</strong> ${lead.contactEmail}</p>
                  ${lead.contactPhone ? `<p><strong>Phone:</strong> ${lead.contactPhone}</p>` : ""}
                </div>
                ` : ""}

                <div class="section">
                  <h3>Call Summary</h3>
                  ${callSession.managerSummary ? (() => {
                    try {
                      const parsed = JSON.parse(callSession.managerSummary);
                      if (Array.isArray(parsed)) {
                        return `<ul>${parsed.map((item: string) => `<li>${item}</li>`).join("")}</ul>`;
                      }
                      return `<p>${callSession.managerSummary}</p>`;
                    } catch {
                      return `<p>${callSession.managerSummary}</p>`;
                    }
                  })() : "<p>No summary available</p>"}
                </div>

                ${callSession.coachingNotes ? `
                <div class="section">
                  <h3>Call Analysis</h3>
                  <p>${callSession.coachingNotes}</p>
                </div>
                ` : ""}

                ${callSession.keyTakeaways ? `
                <div class="section">
                  <h3>Key Takeaways</h3>
                  <p>${callSession.keyTakeaways}</p>
                </div>
                ` : ""}

                ${callSession.nextSteps ? `
                <div class="section">
                  <h3>Next Steps</h3>
                  <p>${callSession.nextSteps}</p>
                </div>
                ` : ""}

                <div class="section">
                  <a href="${transcriptLink}" class="cta">View Full Transcript</a>
                </div>
              </div>
              
              <div class="footer">
                <p>Sent via Lead Intel - BSA Solutions</p>
              </div>
            </div>
          </body>
        </html>
      `;

      await sendFeedbackEmail({
        to: ae.email,
        subject: `Lead Handoff: ${lead?.companyName || "Qualified Lead"} - From ${sdrName}`,
        body: summaryHtml
      });

      if (lead) {
        await storage.updateLead(lead.id, {
          status: "handed_off",
          assignedAeId: aeId,
          handedOffAt: new Date(),
          handedOffBy: callSession.userId
        });
      }

      res.json({ message: "Handoff email sent successfully" });
    } catch (error) {
      console.error("Send to AE error:", error);
      res.status(500).json({ message: "Failed to send handoff email" });
    }
  });

  // ==================== MANAGER DASHBOARD ENDPOINTS ====================

  /**
   * GET /api/manager/activity-feed
   * Real-time activity feed showing recent team actions
   */
  app.get("/api/manager/activity-feed", requireRole("manager", "admin"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get all SDRs under this manager
      const sdrs = user.managerId
        ? await storage.getSdrsByManager(user.managerId)
        : await storage.getAllSdrs();
      const sdrIds = sdrs.map(s => s.id);

      // Get users for these SDRs to look up calls by userId
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);
      const sdrUserIds = sdrUsers.map(u => u.id);
      
      // Create mapping from userId to SDR name and SDR ID
      const userIdToSdrInfo = new Map<string, { sdrId: string; sdrName: string }>();
      sdrUsers.forEach(u => {
        const sdr = sdrs.find(s => s.id === u.sdrId);
        if (sdr && u.sdrId) {
          userIdToSdrInfo.set(u.id, { sdrId: u.sdrId, sdrName: sdr.name });
        }
      });

      // Get recent activities (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get recent call sessions using user IDs
      const allCalls = await storage.getCallSessionsByUserIds(sdrUserIds);
      const recentCalls = allCalls
        .filter(call => new Date(call.startedAt || 0) > oneDayAgo)
        .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
        .slice(0, 50);

      // Get recent lead qualifications
      const allLeads = await storage.getAllLeads();
      const recentQualifications = allLeads
        .filter(lead =>
          sdrIds.includes(lead.assignedSdrId || '') &&
          (lead.status === 'qualified' || lead.status === 'handed_off') &&
          lead.handedOffAt &&
          new Date(lead.handedOffAt) > oneDayAgo
        )
        .slice(0, 20);

      // Build activity feed
      const sdrInfo = (userId: string) => userIdToSdrInfo.get(userId) || { sdrId: userId, sdrName: 'Unknown' };
      const activities = [
        ...recentCalls.map(call => ({
          type: 'call',
          timestamp: call.startedAt,
          sdrId: sdrInfo(call.userId).sdrId,
          sdrName: sdrInfo(call.userId).sdrName,
          userId: call.userId,
          data: {
            toNumber: call.toNumber,
            duration: call.duration,
            disposition: call.disposition,
            callId: call.id,
          }
        })),
        ...recentQualifications.map(lead => ({
          type: 'qualification',
          timestamp: lead.handedOffAt || lead.createdAt,
          sdrId: lead.assignedSdrId,
          sdrName: sdrs.find(s => s.id === lead.assignedSdrId)?.name || 'Unknown',
          data: {
            companyName: lead.companyName,
            contactName: lead.contactName,
            leadId: lead.id,
          }
        }))
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);

      res.json({
        activities,
        stats: {
          callsLast24h: recentCalls.length,
          qualificationsLast24h: recentQualifications.length,
          activeSDRs: new Set(activities.map(a => a.sdrId)).size,
        }
      });
    } catch (error) {
      console.error("Activity feed error:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  /**
   * GET /api/manager/team-performance
   * Team-wide performance metrics for manager dashboard
   */
  app.get("/api/manager/team-performance", requireRole("manager", "admin"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get all SDRs under this manager
      const sdrs = user.managerId
        ? await storage.getSdrsByManager(user.managerId)
        : await storage.getAllSdrs();
      const sdrIds = sdrs.map(s => s.id);

      // Get users for these SDRs to look up calls by userId
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);
      
      // Create mapping from sdrId to userId
      const sdrIdToUserId = new Map<string, string>();
      sdrUsers.forEach(u => {
        if (u.sdrId) sdrIdToUserId.set(u.sdrId, u.id);
      });

      // Calculate metrics for each SDR using call dispositions (consistent with main dashboard)
      const qualifyingDispositions = ['qualified', 'meeting-booked'];
      const sdrMetrics = await Promise.all(
        sdrs.map(async (sdr) => {
          const userId = sdrIdToUserId.get(sdr.id);
          const calls = userId ? await storage.getCallSessionsByUser(userId) : [];
          const leads = await storage.getLeadsBySdr(sdr.id);

          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const weekCalls = calls.filter(c => new Date(c.startedAt || 0) > weekAgo);
          
          // Count qualified from call dispositions (same as main dashboard)
          const weekQualifiedCalls = weekCalls.filter(c => 
            qualifyingDispositions.includes(c.disposition || '')
          );
          
          // Count meetings booked specifically
          const weekMeetings = weekCalls.filter(c => c.disposition === 'meeting-booked');

          return {
            sdrId: sdr.id,
            sdrName: sdr.name,
            email: sdr.email,
            callsThisWeek: weekCalls.length,
            qualifiedThisWeek: weekQualifiedCalls.length,
            meetingsThisWeek: weekMeetings.length,
            totalLeads: leads.length,
            conversionRate: weekCalls.length > 0
              ? Math.round((weekQualifiedCalls.length / weekCalls.length) * 100)
              : 0,
            avgCallDuration: weekCalls.length > 0
              ? Math.round(weekCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / weekCalls.length)
              : 0,
          };
        })
      );

      // Calculate team totals
      const teamTotals = {
        totalCalls: sdrMetrics.reduce((sum, m) => sum + m.callsThisWeek, 0),
        totalQualified: sdrMetrics.reduce((sum, m) => sum + m.qualifiedThisWeek, 0),
        totalMeetings: sdrMetrics.reduce((sum, m) => sum + m.meetingsThisWeek, 0),
        avgConversionRate: sdrMetrics.length > 0
          ? Math.round(sdrMetrics.reduce((sum, m) => sum + m.conversionRate, 0) / sdrMetrics.length)
          : 0,
        teamSize: sdrs.length,
      };

      res.json({
        teamMetrics: teamTotals,
        sdrPerformance: sdrMetrics.sort((a, b) => b.qualifiedThisWeek - a.qualifiedThisWeek),
        topPerformers: sdrMetrics
          .sort((a, b) => b.conversionRate - a.conversionRate)
          .slice(0, 3),
      });
    } catch (error) {
      console.error("Team performance error:", error);
      res.status(500).json({ message: "Failed to fetch team performance" });
    }
  });

  /**
   * GET /api/manager/coaching-queue
   * Calls that need manager review or have coaching opportunities
   */
  app.get("/api/manager/coaching-queue", requireRole("manager", "admin"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get all SDRs under this manager
      const sdrs = user.managerId
        ? await storage.getSdrsByManager(user.managerId)
        : await storage.getAllSdrs();
      const sdrIds = sdrs.map(s => s.id);

      // Get users for these SDRs to look up calls by userId
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);
      const sdrUserIds = sdrUsers.map(u => u.id);
      
      // Create mapping from userId to SDR name
      const userIdToSdrName = new Map<string, string>();
      sdrUsers.forEach(u => {
        const sdr = sdrs.find(s => s.id === u.sdrId);
        if (sdr) userIdToSdrName.set(u.id, sdr.name);
      });

      // Get all call sessions for team using user IDs
      const allCalls = await storage.getCallSessionsByUserIds(sdrUserIds);

      // Filter for coaching opportunities
      const coachingQueue = allCalls
        .filter(call =>
          call.status === 'completed' &&
          call.transcriptText && // Has transcript
          call.duration && call.duration > 60 && // Meaningful duration
          !call.managerSummary // Not yet reviewed by manager
        )
        .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
        .slice(0, 20);

      // Enrich with SDR names
      const enrichedQueue = coachingQueue.map(call => ({
        ...call,
        sdrName: userIdToSdrName.get(call.userId) || 'Unknown',
      }));

      res.json({
        queue: enrichedQueue,
        stats: {
          totalPending: enrichedQueue.length,
          averageCallDuration: enrichedQueue.length > 0
            ? Math.round(enrichedQueue.reduce((sum, c) => sum + (c.duration || 0), 0) / enrichedQueue.length)
            : 0,
        }
      });
    } catch (error) {
      console.error("Coaching queue error:", error);
      res.status(500).json({ message: "Failed to fetch coaching queue" });
    }
  });

  /**
   * GET /api/manager/automation-roi
   * Tracks adoption and time savings from automation features
   */
  app.get("/api/manager/automation-roi", requireRole("manager", "admin"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session!.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Get all SDRs under this manager
      const sdrs = user.managerId
        ? await storage.getSdrsByManager(user.managerId)
        : await storage.getAllSdrs();
      const sdrIds = sdrs.map(s => s.id);

      // Get users for these SDRs to look up calls by userId
      const sdrUsers = await storage.getUsersBySdrIds(sdrIds);
      const sdrUserIds = sdrUsers.map(u => u.id);

      // Get all data for the last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get all call sessions for team using user IDs
      const allCalls = await storage.getCallSessionsByUserIds(sdrUserIds);

      const recentCalls = allCalls.filter(c => new Date(c.startedAt || 0) > weekAgo);

      // Get all leads for team
      const allLeads = await storage.getAllLeads();
      const teamLeads = allLeads.filter(lead => sdrIds.includes(lead.assignedSdrId || ''));
      const recentLeads = teamLeads.filter(l => new Date(l.createdAt) > weekAgo);

      // Metric 1: Auto-disposition usage
      // Calls with disposition set (indicating form was used)
      const callsWithDisposition = recentCalls.filter(c => c.disposition);
      const autoDispositionUsageRate = recentCalls.length > 0
        ? Math.round((callsWithDisposition.length / recentCalls.length) * 100)
        : 0;

      // Assume 30 seconds saved per auto-suggested disposition
      const autoDispositionTimeSaved = callsWithDisposition.length * 0.5; // minutes

      // Metric 2: BANT extraction usage
      // Count leads with BANT data populated (budget, timeline, or decisionMakers)
      const leadsWithBANT = recentLeads.filter(l =>
        l.budget || l.timeline || l.decisionMakers
      );
      const bantExtractionUsageRate = recentLeads.length > 0
        ? Math.round((leadsWithBANT.length / recentLeads.length) * 100)
        : 0;

      // Assume 2 minutes saved per BANT auto-extraction
      const bantExtractionTimeSaved = leadsWithBANT.length * 2; // minutes

      // Metric 3: Smart handoff usage
      // Count qualified/handed_off leads from this week
      const qualifiedLeads = teamLeads.filter(l =>
        (l.status === 'qualified' || l.status === 'handed_off') &&
        l.handedOffAt &&
        new Date(l.handedOffAt) > weekAgo
      );

      // Assume 4 minutes saved per smart handoff
      const smartHandoffTimeSaved = qualifiedLeads.length * 4; // minutes

      // Metric 4: Last contact tracking (passive benefit - engagement improvement)
      // Track how many leads were contacted this week
      const contactedLeads = teamLeads.filter(l =>
        l.lastContactedAt && new Date(l.lastContactedAt) > weekAgo
      );

      // Total time saved
      const totalTimeSaved = autoDispositionTimeSaved + bantExtractionTimeSaved + smartHandoffTimeSaved;
      const timeSavedPerSDR = sdrs.length > 0 ? totalTimeSaved / sdrs.length : 0;

      // ROI calculation
      // Assume SDR hourly rate of $25/hour
      const sdrHourlyRate = 25;
      const moneySaved = (totalTimeSaved / 60) * sdrHourlyRate;

      res.json({
        metrics: {
          autoDisposition: {
            usage: callsWithDisposition.length,
            totalCalls: recentCalls.length,
            usageRate: autoDispositionUsageRate,
            timeSaved: Math.round(autoDispositionTimeSaved),
          },
          bantExtraction: {
            usage: leadsWithBANT.length,
            totalLeads: recentLeads.length,
            usageRate: bantExtractionUsageRate,
            timeSaved: Math.round(bantExtractionTimeSaved),
          },
          smartHandoff: {
            usage: qualifiedLeads.length,
            timeSaved: Math.round(smartHandoffTimeSaved),
          },
          lastContactTracking: {
            contactedLeads: contactedLeads.length,
            totalLeads: teamLeads.length,
          },
        },
        summary: {
          totalTimeSaved: Math.round(totalTimeSaved),
          timeSavedPerSDR: Math.round(timeSavedPerSDR),
          moneySaved: Math.round(moneySaved * 100) / 100,
          teamSize: sdrs.length,
          period: '7 days',
        },
      });
    } catch (error) {
      console.error("Automation ROI error:", error);
      res.status(500).json({ message: "Failed to fetch automation ROI" });
    }
  });

  registerLeadsRoutes(app, requireAuth);
  registerCoachRoutes(app, requireAuth);
  registerSalesforceRoutes(app, requireAuth);
  registerSupportRoutes(app);
  registerAgentRoutes(app);
  registerZoomRoutes(app);
  app.use("/api/reports/pdf", reportRoutes);
  app.use("/api/ai-reports", aiReportsRoutes);
  app.use("/api/baseline", baselineRoutes);
  registerTwilioVoiceRoutes(app);
  registerTranscriptionRoutes(app);
  setupTranscriptionWebSocket(httpServer);

  return httpServer;
}
