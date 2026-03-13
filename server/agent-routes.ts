/**
 * Agent API Routes
 * Endpoints for interacting with the multi-agent system
 */

import { Express, Request, Response, NextFunction } from 'express';
import {
  executeAgent,
  executeDirector,
  detectRequestedAgent,
  routeToAgent,
  getAgentInfo,
  getAvailableAgents,
  AgentType,
  AgentRequest,
  AGENT_CONFIG
} from './agents/index.js';
import { storage } from './storage.js';
import { processLeadResearch } from './leads-routes.js';
import { notifyResearchComplete } from './dashboardUpdates.js';
import { scrubLead } from './ai/leadResearch.js';
import pLimit from 'p-limit';

// Authentication middleware (reuse from routes.ts pattern)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

export function registerAgentRoutes(app: Express) {
  /**
   * GET /api/agents
   * List all available agents with their info
   */
  app.get('/api/agents', requireAuth, (req: Request, res: Response) => {
    const agents = getAvailableAgents().map(agentType => ({
      type: agentType,
      ...AGENT_CONFIG[agentType]
    }));
    res.json({ agents });
  });

  /**
   * GET /api/agents/:type
   * Get info about a specific agent
   */
  app.get('/api/agents/:type', requireAuth, (req: Request, res: Response) => {
    const agentType = req.params.type as AgentType;

    if (!AGENT_CONFIG[agentType]) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    res.json({
      type: agentType,
      ...AGENT_CONFIG[agentType]
    });
  });

  /**
   * POST /api/agents/ask
   * Main endpoint - ask any agent a question
   * Auto-routes to appropriate agent if not specified
   */
  app.post('/api/agents/ask', requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, agentType: requestedAgent, conversationHistory, includeUserData = true } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Message is required' });
      }

      // Get user context
      const userId = req.session!.userId;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const userContext = {
        userId,
        userRole: user.role as 'admin' | 'manager' | 'sdr' | 'account_executive' | 'account_specialist',
        sdrId: user.sdrId || undefined,
        managerId: user.managerId || undefined
      };

      // Determine which agent to use
      let agentType: AgentType;

      // Check for explicit @mention first
      const mentionedAgent = detectRequestedAgent(message);
      if (mentionedAgent) {
        agentType = mentionedAgent;
      } else if (requestedAgent && AGENT_CONFIG[requestedAgent as AgentType]) {
        // Use explicitly requested agent
        agentType = requestedAgent as AgentType;
      } else {
        // Auto-route based on message content
        agentType = routeToAgent(message);
      }

      console.log(`[AgentRoutes] Routing to ${agentType} for: ${message.substring(0, 50)}...`);

      // Build agent request
      const agentRequest: AgentRequest = {
        message: message.replace(/@\w+\s*/g, '').trim(), // Remove @mentions from message
        agentType,
        conversationHistory,
        userContext,
        includeUserData
      };

      // Execute appropriate agent
      let response;
      if (agentType === 'director') {
        response = await executeDirector(agentRequest);
      } else {
        response = await executeAgent(agentRequest);
      }

      res.json(response);
    } catch (error) {
      console.error('[AgentRoutes] Error processing agent request:', error);
      res.status(500).json({
        message: 'Failed to process agent request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/agents/director
   * Direct access to Director agent for orchestration
   */
  app.post('/api/agents/director', requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory } = req.body;

      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      const userId = req.session!.userId;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const agentRequest: AgentRequest = {
        message,
        agentType: 'director',
        conversationHistory,
        userContext: {
          userId,
          userRole: user.role as 'admin' | 'manager' | 'sdr' | 'account_executive' | 'account_specialist',
          sdrId: user.sdrId || undefined,
          managerId: user.managerId || undefined
        },
        includeUserData: true
      };

      const response = await executeDirector(agentRequest);
      res.json(response);
    } catch (error) {
      console.error('[AgentRoutes] Error in director:', error);
      res.status(500).json({
        message: 'Director agent failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/agents/:type/ask
   * Ask a specific agent directly
   */
  app.post('/api/agents/:type/ask', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentType = req.params.type as AgentType;

      if (!AGENT_CONFIG[agentType]) {
        return res.status(404).json({ message: 'Agent not found' });
      }

      const { message, conversationHistory, includeUserData = true } = req.body;

      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      const userId = req.session!.userId;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const agentRequest: AgentRequest = {
        message,
        agentType,
        conversationHistory,
        userContext: {
          userId,
          userRole: user.role as 'admin' | 'manager' | 'sdr' | 'account_executive' | 'account_specialist',
          sdrId: user.sdrId || undefined,
          managerId: user.managerId || undefined
        },
        includeUserData
      };

      let response;
      if (agentType === 'director') {
        response = await executeDirector(agentRequest);
      } else {
        response = await executeAgent(agentRequest);
      }

      res.json(response);
    } catch (error) {
      console.error(`[AgentRoutes] Error in ${req.params.type}:`, error);
      res.status(500).json({
        message: 'Agent request failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/agents/quick-actions/:role
   * Get suggested quick actions for a user role
   */
  app.get('/api/agents/quick-actions/:role', requireAuth, (req: Request, res: Response) => {
    const role = req.params.role;

    const quickActions: Record<string, Array<{ label: string; message: string; agent: AgentType }>> = {
      sdr: [
        { label: '🔍 Research my top lead', message: '@researcher Research my highest priority lead and give me talk tracks', agent: 'researcher' },
        { label: '📊 How am I doing?', message: '@analyst Analyze my performance this week and suggest improvements', agent: 'business-analyst' },
        { label: '📞 Prep for next call', message: '@researcher Give me a pre-call brief for my next scheduled lead', agent: 'researcher' },
        { label: '💡 Coaching tips', message: 'What should I focus on to improve my qualification rate?', agent: 'sage' }
      ],
      manager: [
        { label: '📊 Team performance', message: '@analyst Give me a team performance overview for this week', agent: 'business-analyst' },
        { label: '🔍 Who needs coaching?', message: '@analyst Which SDRs need coaching and on what skills?', agent: 'business-analyst' },
        { label: '📈 Pipeline health', message: '@analyst Analyze our pipeline health and forecast next month', agent: 'business-analyst' },
        { label: '🎬 Full analysis', message: '@director Why is our qualification rate declining? Diagnose and suggest fixes.', agent: 'director' }
      ],
      admin: [
        { label: '🎬 System analysis', message: '@director Give me a comprehensive system health check', agent: 'director' },
        { label: '📊 Company metrics', message: '@analyst Analyze company-wide sales performance', agent: 'business-analyst' },
        { label: '🎨 UX audit', message: '@ux Audit our main workflows for usability issues', agent: 'ux-agent' }
      ],
      account_executive: [
        { label: '🔍 Research handoff', message: '@researcher Research my latest handoff lead in depth', agent: 'researcher' },
        { label: '📊 Pipeline review', message: '@analyst Review my pipeline and prioritize opportunities', agent: 'business-analyst' }
      ]
    };

    const actions = quickActions[role] || quickActions.sdr;
    res.json({ quickActions: actions });
  });

  /**
   * POST /api/agents/dossier/:leadId
   * Dossier Agent — runs pre-call research for a single lead.
   * Wraps processLeadResearch() with agent metadata in the response.
   *
   * Body (optional):
   *   mode: 'fast' | 'deep'  — default 'fast'
   *   forceRefresh: boolean   — default false
   */
  app.post('/api/agents/dossier/:leadId', requireAuth, async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const leadId = req.params.leadId;
      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const { mode = 'fast', forceRefresh = false } = req.body as {
        mode?: 'fast' | 'deep';
        forceRefresh?: boolean;
      };

      const userId = req.session!.userId;

      const result = await processLeadResearch(lead, {
        forceRefresh,
        notifyUserId: userId,
        researchMode: mode,
      });

      if (!result.success && !result.packet) {
        return res.status(500).json({ message: 'Dossier Agent: research failed' });
      }

      if (!result.isExisting && userId) {
        notifyResearchComplete(leadId, userId);
      }

      const durationMs = Date.now() - startedAt;

      res.json({
        agent: 'dossier',
        model: 'claude-opus-4-20250514',
        leadId,
        companyName: lead.companyName,
        contactName: lead.contactName,
        mode: result.researchMode || mode,
        isExisting: result.isExisting ?? false,
        durationMs,
        dossier: result.packet,
      });
    } catch (error) {
      console.error('[DossierAgent] Error:', error);
      res.status(500).json({
        message: 'Dossier Agent failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/agents/scrub/bulk
   * Scrubbing Agent — lightweight batch lead qualification using Claude Haiku.
   * No web scraping. Uses only data already in the lead record.
   * Updates fitScore, priority, and disqualificationReason in the DB for each lead.
   *
   * Body:
   *   leadIds?: string[]          — specific leads to scrub (max 100)
   *   filter?: {
   *     status?: string           — e.g. "new" to scrub all new leads
   *     assignedSdrId?: string
   *   }
   *   concurrency?: number        — parallel requests (default 5, max 10)
   */
  app.post('/api/agents/scrub/bulk', requireAuth, async (req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const { leadIds, filter, concurrency = 5 } = req.body as {
        leadIds?: string[];
        filter?: { status?: string; assignedSdrId?: string };
        concurrency?: number;
      };

      // Resolve leads to scrub
      type Lead = Awaited<ReturnType<typeof storage.getLead>>;
      let leads: NonNullable<Lead>[] = [];

      if (leadIds && leadIds.length > 0) {
        const capped = leadIds.slice(0, 100);
        const fetched = await Promise.all(capped.map((id) => storage.getLead(id)));
        leads = fetched.filter((l): l is NonNullable<Lead> => l !== null && l !== undefined);
      } else if (filter) {
        const all = await storage.getAllLeads();
        leads = all.filter((l) => {
          if (filter.status && l.status !== filter.status) return false;
          if (filter.assignedSdrId && l.assignedSdrId !== filter.assignedSdrId) return false;
          return true;
        }).slice(0, 100);
      } else {
        return res.status(400).json({ message: 'Provide leadIds or a filter object' });
      }

      if (leads.length === 0) {
        return res.json({ agent: 'scrubbing', processed: 0, results: [], durationMs: 0 });
      }

      // Run scrubs with bounded concurrency
      const limit = pLimit(Math.min(concurrency, 10));
      const results = await Promise.allSettled(
        leads.map((lead) =>
          limit(async () => {
            const result = await scrubLead(lead);

            // Persist scores back to DB
            await storage.updateLead(lead.id, {
              fitScore: result.fitScore,
              priority: result.priority,
              ...(result.disqualificationReason
                ? { disqualificationReason: result.disqualificationReason }
                : {}),
            });

            return result;
          })
        )
      );

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof scrubLead>>> => r.status === 'fulfilled')
        .map((r) => r.value);

      const failed = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message || 'Unknown error');

      // Summary stats
      const qualified = succeeded.filter((r) => r.qualifies).length;
      const disqualified = succeeded.filter((r) => !r.qualifies).length;
      const avgScore = succeeded.length > 0
        ? Math.round(succeeded.reduce((s, r) => s + r.fitScore, 0) / succeeded.length)
        : 0;
      const byPriority: Record<'hot' | 'warm' | 'cool' | 'cold', number> = { hot: 0, warm: 0, cool: 0, cold: 0 };
      for (const r of succeeded) byPriority[r.priority]++;

      res.json({
        agent: 'scrubbing',
        model: 'claude-haiku-4-5-20251001',
        processed: succeeded.length,
        failed: failed.length,
        qualified,
        disqualified,
        avgFitScore: avgScore,
        byPriority,
        durationMs: Date.now() - startedAt,
        results: succeeded,
        errors: failed.length > 0 ? failed : undefined,
      });
    } catch (error) {
      console.error('[ScrubAgent] Error:', error);
      res.status(500).json({
        message: 'Scrubbing Agent failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  console.log('[AgentRoutes] Agent routes registered');
}
