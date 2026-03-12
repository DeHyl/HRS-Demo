# CLAUDE.md - AI Assistant Guide for Lead Intel

> **Last Updated:** March 11, 2026
> **Repository:** HRS-Demo (fork of BSA-demo)
> **Type:** Full-stack TypeScript monorepo (React + Express.js)

This document provides comprehensive guidance for AI assistants working on the Lead Intel codebase. It covers project structure, development workflows, key conventions, and common tasks.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack Summary](#tech-stack-summary)
3. [Repository Structure](#repository-structure)
4. [Development Workflows](#development-workflows)
5. [Architecture Patterns](#architecture-patterns)
6. [Database Schema & Conventions](#database-schema--conventions)
7. [API Conventions](#api-conventions)
8. [Frontend Patterns](#frontend-patterns)
9. [AI Integration Guidelines](#ai-integration-guidelines)
10. [Common Tasks](#common-tasks)
11. [Testing & Debugging](#testing--debugging)
12. [Deployment](#deployment)
13. [Key Files Reference](#key-files-reference)
14. [Multi-Agent System](#multi-agent-system)
15. [Ralph Iterative Development](#ralph-iterative-development)
16. [Continuous Reflection & Best Practices](#continuous-reflection--best-practices)

---

## Project Overview

**Lead Intel** is an AI-powered Sales Intelligence & Coaching Platform for BSA Solutions. It combines:

- **Automated Lead Research**: Multi-source intelligence gathering using Google Gemini AI
- **Real-Time Call Coaching**: Live coaching tips during calls via Twilio browser softphone
- **Performance Analytics**: 7-dimensional call scoring and team metrics
- **Pipeline Management**: Lead qualification, handoff tracking, and status workflows

**Key Users:**
- SDRs (Sales Development Representatives) - Primary users making calls
- Sales Managers - Oversight, coaching, performance review
- Account Executives - Receive qualified leads from SDRs
- Admins - System configuration

**External Integrations:**
- Google Workspace (Sheets, Drive, Gmail)
- Google Gemini AI (via Replit AI Integrations)
- Anthropic Claude AI (call coaching analysis)
- Salesforce CRM (OAuth 2.0 lead sync)
- Twilio Voice (browser-based calling)
- Zoom Phone (call recording & transcription)
- SerpAPI (LinkedIn profile discovery)
- XAI API (Twitter/X research)

---

## Tech Stack Summary

### Backend
- **Runtime:** Node.js 20 + TypeScript 5.6.3
- **Framework:** Express.js 4.21.2
- **Database:** PostgreSQL 16 (Replit managed)
- **ORM:** Drizzle ORM 0.39.3
- **Auth:** Passport.js (local strategy) + express-session
- **WebSocket:** ws 8.18.0
- **Build:** esbuild 0.25.0

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 7.3.0
- **Routing:** Wouter 3.3.5
- **State:** TanStack React Query 5.60.5 + React Context
- **Styling:** Tailwind CSS 3.4.17
- **UI Library:** shadcn/ui (Radix UI primitives)
- **Forms:** React Hook Form 7.55.0 + Zod validation
- **3D Graphics:** Three.js + @react-three/fiber

### Key Libraries
- **Validation:** Zod 3.25.76 (runtime validation)
- **Date Handling:** date-fns 3.6.0
- **HTTP Client:** fetch API (native)
- **AI (Gemini):** @google/generative-ai 0.24.1
- **AI (Claude):** @anthropic-ai/sdk 0.71.2
- **Voice:** @twilio/voice-sdk 2.17.0
- **Testing:** Playwright (E2E, accessibility)

---

## Repository Structure

```
BSA-demo/
├── .claude/                         # AI Agent & Development System
│   ├── agents/                     # Multi-agent system
│   │   ├── README.md               # Agent documentation
│   │   ├── director.md             # Director agent prompt
│   │   ├── researcher.md           # Researcher agent prompt
│   │   ├── business-analyst.md     # Business analyst prompt
│   │   └── ux-agent.md             # UX agent prompt
│   ├── ralph/                      # Ralph iterative development
│   │   ├── README.md               # Ralph methodology guide
│   │   ├── QUICKSTART.md           # Quick start guide
│   │   ├── AGENTS.md               # Project context for agents
│   │   ├── progress.txt            # Append-only progress log
│   │   ├── v2-production.json      # Active MVP PRD
│   │   └── templates/
│   │       └── prd-template.json   # PRD template
│   └── discovery/                  # Discovery & planning docs
│       ├── design-system-v2.md
│       ├── hawk-ridge-requirements.md
│       ├── migration-plan.md
│       ├── ux-mockups.md
│       └── v2-architecture.md
│
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── pages/                  # Route components (18 pages)
│   │   │   ├── landing.tsx         # Marketing homepage
│   │   │   ├── login.tsx           # Authentication
│   │   │   ├── signup.tsx          # User registration
│   │   │   ├── dashboard.tsx       # SDR main KPI dashboard
│   │   │   ├── manager-dashboard.tsx # Manager oversight view
│   │   │   ├── leads.tsx           # Lead management
│   │   │   ├── coaching.tsx        # Live call coaching
│   │   │   ├── call-prep.tsx       # Pre-call research view
│   │   │   ├── team.tsx            # Team management
│   │   │   ├── reports.tsx         # Analytics
│   │   │   ├── settings.tsx        # User settings
│   │   │   ├── ae-pipeline.tsx     # AE pipeline view
│   │   │   ├── budgeting.tsx       # Territory budgeting
│   │   │   ├── learning.tsx        # Learning resources
│   │   │   ├── sdr-profile.tsx     # SDR profile page
│   │   │   ├── manager-profile.tsx # Manager profile page
│   │   │   ├── ae-profile.tsx      # Account Executive profile
│   │   │   └── not-found.tsx       # 404 page
│   │   ├── components/             # React components (81+)
│   │   │   ├── ui/                 # shadcn/ui library (55 components)
│   │   │   ├── ai-reports/         # AI-powered report components (8)
│   │   │   │   ├── executive-summary.tsx
│   │   │   │   ├── performance-trends.tsx
│   │   │   │   ├── team-comparison.tsx
│   │   │   │   └── ... (5 more)
│   │   │   ├── softphone.tsx       # Twilio voice integration
│   │   │   ├── call-brief.tsx      # Pre-call intelligence display
│   │   │   ├── call-review-dialog.tsx # Post-call review
│   │   │   ├── call-queue.tsx      # Call queue management
│   │   │   ├── kanban-board.tsx    # Lead pipeline board
│   │   │   ├── zoom-phone-embed.tsx # Zoom Phone widget
│   │   │   ├── app-sidebar.tsx     # Main navigation
│   │   │   ├── manager-oversight-dashboard.tsx # Manager analytics
│   │   │   └── post-call-summary-form.tsx # Call outcome form
│   │   ├── hooks/                  # Custom React hooks (6)
│   │   │   ├── use-transcription.ts # WebSocket transcription
│   │   │   ├── use-agents.ts       # Agent interaction
│   │   │   ├── use-dashboard-updates.ts # Real-time dashboard sync
│   │   │   ├── use-keyboard-shortcuts.ts # Keyboard shortcuts
│   │   │   ├── use-toast.ts
│   │   │   └── use-mobile.tsx
│   │   ├── lib/
│   │   │   ├── auth.tsx            # Auth context & hooks
│   │   │   ├── queryClient.ts      # React Query config
│   │   │   └── utils.ts            # Helper functions
│   │   ├── App.tsx                 # Main router
│   │   └── main.tsx                # React entry point
│   └── index.html
│
├── server/                          # Express.js backend (74 TypeScript files)
│   ├── ai/                         # AI modules (28 modules)
│   │   ├── leadResearch.ts         # Main research orchestrator
│   │   ├── websiteScraper.ts       # Website & LinkedIn scraping
│   │   ├── xResearch.ts            # X/Twitter research
│   │   ├── linkedInResearch.ts     # LinkedIn data extraction
│   │   ├── companyHardIntel.ts     # Company intelligence
│   │   ├── productCatalog.ts       # Product matching
│   │   ├── analyze.ts              # Post-call analysis
│   │   ├── coachingAnalysis.ts     # Live coaching tips (Gemini)
│   │   ├── callCoachingAnalysis.ts # Call coaching (Claude)
│   │   ├── claudeClient.ts         # Claude SDK wrapper
│   │   ├── qualificationExtractor.ts # BANT extraction
│   │   ├── bantExtraction.ts       # Alternative BANT extraction
│   │   ├── managerAnalysis.ts      # Manager performance analysis
│   │   ├── reportsAnalysis.ts      # AI report generation
│   │   ├── baselineMetrics.ts      # Success metrics analysis
│   │   ├── dashboardInsights.ts    # Dashboard insights
│   │   ├── dispositionSuggestion.ts # Call outcome prediction
│   │   ├── transcribe.ts           # Audio transcription
│   │   ├── serpApiClient.ts        # LinkedIn search API
│   │   ├── zoomClient.ts           # Zoom Phone integration
│   │   ├── browserlessClient.ts    # Browserless.io integration
│   │   ├── scrapers/               # Web scraping modules (5 files)
│   │   └── helpers/                # AI helper functions
│   │
│   ├── agents/                     # Multi-Agent System (server-side)
│   │   ├── director.ts             # Orchestrator agent (12KB)
│   │   ├── agentExecutor.ts        # Execution engine
│   │   ├── promptLoader.ts         # Prompt management
│   │   └── types.ts                # Type definitions
│   │
│   ├── integrations/               # External service integrations
│   │   ├── salesforceClient.ts     # Salesforce OAuth & REST API
│   │   └── salesforceLeads.ts      # Lead sync operations
│   │
│   ├── google/                     # Google Workspace integrations
│   │   ├── config.ts               # Google API configuration
│   │   ├── sheetsClient.ts         # Google Sheets API
│   │   ├── driveClient.ts          # Google Drive operations
│   │   └── gmailClient.ts          # Gmail sending
│   │
│   ├── helpers/                    # Server utilities
│   │   ├── authHelpers.ts          # Password hashing, session
│   │   ├── leadResearchHelpers.ts  # Research utilities
│   │   ├── managerProfileHelpers.ts # Manager analytics
│   │   └── coachingEmailHelpers.ts # Email formatting
│   │
│   ├── middleware/                 # Express middleware
│   │   └── auth.ts                 # Authentication middleware
│   │
│   ├── prompts/                    # AI Prompts
│   │   └── supportAgent.ts         # Support chat agent prompt
│   │
│   ├── replit_integrations/        # Replit AI services (placeholder)
│   │
│   ├── routes.ts                   # Main API routes (50+ endpoints)
│   ├── leads-routes.ts             # Leads-specific routes
│   ├── coach-routes.ts             # Coaching routes
│   ├── ai-reports-routes.ts        # AI-generated reports
│   ├── baseline-routes.ts          # Success metrics tracking
│   ├── support-routes.ts           # Support AI agent (1,600+ lines)
│   ├── agent-routes.ts             # Multi-agent system routes
│   ├── salesforce-routes.ts        # Salesforce API endpoints
│   ├── zoom-routes.ts              # Zoom Phone integration
│   ├── twilio-voice.ts             # Twilio Voice integration
│   ├── transcription.ts            # WebSocket transcription
│   ├── notificationService.ts      # Real-time notifications
│   ├── dashboardUpdates.ts         # WebSocket dashboard sync
│   ├── pdf-service.ts              # PDF generation
│   ├── storage.ts                  # Database abstraction (772 lines)
│   ├── db.ts                       # Drizzle ORM connection
│   ├── vite.ts                     # Vite dev server setup
│   ├── static.ts                   # Static file serving
│   └── index.ts                    # Express app initialization
│
├── shared/                         # Shared code
│   ├── schema.ts                   # Database schema & Zod validators (350+ lines)
│   └── models/
│       └── chat.ts                 # Chat/conversation models
│
├── docs/                           # Documentation
│   ├── discovery/                  # Client discovery & integration specs
│   │   ├── DISCOVERY_QUESTIONNAIRE.md  # Client requirements questionnaire
│   │   └── BROWSERLESS_INTEGRATION_SPEC.md # Browserless.io integration
│   ├── BASELINE_SUCCESS_METRICS.md # Success metrics documentation
│   ├── SALESFORCE_INTEGRATION_GUIDE.md # Salesforce setup guide
│   ├── SUPPORT_CHAT_GUIDE.md       # Support chat documentation
│   ├── WORKFLOW.md                 # Platform workflow docs
│   └── groundgame-*.md             # Sales methodology guides
│
├── scripts/                        # Build & test scripts
│   ├── seedDemoData.ts             # Demo data seeding
│   └── playwright-ux/              # UX testing
│       ├── README.md
│       ├── accessibility-audit.ts  # A11y compliance
│       ├── screenshot.ts           # Visual regression
│       └── user-flow.ts            # E2E user journeys
│
├── attached_assets/                # Images & media
│   ├── generated_images/
│   └── stock_images/
│
├── migrations/                     # Drizzle migrations
│
├── package.json                    # Dependencies (137 packages)
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite config
├── drizzle.config.ts               # Drizzle ORM config
├── tailwind.config.ts              # Tailwind CSS config
├── postcss.config.js               # PostCSS config
├── components.json                 # shadcn/ui config
├── playwright.config.ts            # Playwright test config
└── .replit                         # Replit environment config
```

### Key Metrics
- **Total TypeScript Files:** 215
- **Total Lines of Code:** ~61,763
- **Total API Endpoints:** 50+
- **Frontend Pages:** 18
- **UI Components:** 81+ (26 custom + 55 shadcn/ui)
- **Custom React Hooks:** 6
- **Database Tables:** 15+ primary tables
- **AI Modules:** 28 specialized modules
- **NPM Dependencies:** 137 packages

---

## Development Workflows

### Getting Started

```bash
# Install dependencies
npm install

# Set up database (push schema)
npm run db:push

# Start development server
npm run dev
```

### Development Mode

```bash
npm run dev
# Starts Express server with Vite dev server
# - Backend: http://localhost:5000
# - Frontend: Served via Vite middleware (HMR enabled)
# - Hot module replacement for React
# - TypeScript compilation on-the-fly
```

### Building for Production

```bash
npm run build
# 1. Builds client (React/Vite) -> dist/public/
# 2. Builds server (esbuild) -> dist/index.cjs
# 3. Bundles dependencies selectively
```

### Type Checking

```bash
npm run check
# Runs TypeScript compiler in check mode (no output)
```

### Database Operations

```bash
# Push schema changes to database
npm run db:push

# Generate migration (manual)
npx drizzle-kit generate
```

### Git Workflow

**Standard Workflow:**
1. Make changes on feature branch
2. Commit with descriptive messages
3. Push to origin: `git push -u origin <branch-name>`
4. Create PR to main branch

**Important:** Always develop on designated feature branches starting with `claude/` and ending with session ID.

**Branch Naming Convention:**
```
claude/{description}-{sessionId}
```
Example: `claude/claude-md-mkpr91qo4f27550u-1HgEg`

---

## Architecture Patterns

### Overall System Architecture

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vite)               │
│  - Client-side routing (Wouter)            │
│  - TanStack Query (server state)           │
│  - React Context (auth state)              │
│  - WebSocket (transcription)               │
└─────────────────────────────────────────────┘
           ↓↑ HTTP/REST + WebSocket
┌─────────────────────────────────────────────┐
│       Express.js Backend (Node.js)          │
│  ┌─────────────────────────────────────┐   │
│  │ Middleware Stack                    │   │
│  │ - Session Management                │   │
│  │ - Authentication (Passport)         │   │
│  │ - Role Authorization                │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Route Handlers                      │   │
│  │ - /api/auth/*                       │   │
│  │ - /api/leads/*                      │   │
│  │ - /api/coach/*                      │   │
│  │ - /api/call-sessions/*              │   │
│  │ - /api/manager/*                    │   │
│  │ - /api/ai-reports/*                 │   │
│  │ - /api/baseline/*                   │   │
│  │ - /api/support/*                    │   │
│  │ - /api/agents/*                     │   │
│  │ - /api/salesforce/*                 │   │
│  │ - /api/zoom/*                       │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Business Logic Layer                │   │
│  │ - AI Modules (server/ai/)           │   │
│  │ - Storage Layer (server/storage.ts) │   │
│  │ - Google Integrations               │   │
│  │ - Twilio Integration                │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
           ↓↑ Drizzle ORM
┌─────────────────────────────────────────────┐
│      PostgreSQL Database (Replit)           │
│  - Users, SDRs, Managers, Leads            │
│  - Call Sessions, Transcripts              │
│  - Research Packets, Analyses              │
└─────────────────────────────────────────────┘

External Services:
├── Google Gemini AI (via Replit AI Integrations)
├── Anthropic Claude AI (call coaching analysis)
├── Google Workspace (Sheets, Drive, Gmail)
├── Salesforce CRM (OAuth 2.0 lead sync)
├── Twilio Voice (VOIP)
├── Zoom Phone (call recording)
├── SerpAPI (LinkedIn search)
└── XAI API (X/Twitter)
```

### Key Patterns

#### 1. Storage Layer Pattern

**File:** `server/storage.ts`

```typescript
// Abstract interface for storage operations
interface IStorage {
  // User operations
  getUserByEmail(email: string): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;

  // Lead operations
  getLeads(): Promise<Lead[]>;
  createLead(data: InsertLead): Promise<Lead>;

  // ... 50+ methods
}

// Implementation using Drizzle ORM
class DatabaseStorage implements IStorage {
  // All database operations encapsulated here
}

// Singleton instance
export const storage = new DatabaseStorage();
```

**Usage in Routes:**
```typescript
import { storage } from './storage.js';

app.get('/api/leads', requireAuth, async (req, res) => {
  const leads = await storage.getLeads();
  res.json(leads);
});
```

**Benefits:**
- Single source of truth for data access
- Type-safe operations
- Easy to mock for testing
- Consistent error handling

#### 2. Authentication Middleware Pattern

**File:** `server/routes.ts`

```typescript
// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

// Role-based authorization
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await storage.getUserById(req.session!.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage
app.get('/api/manager/oversight',
  requireAuth,
  requireRole('manager', 'admin'),
  async (req, res) => {
    // Handler code
  }
);
```

#### 3. React Query Pattern

**File:** `client/src/lib/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Custom query function with auth
async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include', // Include session cookie
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res.json();
}
```

**Usage in Components:**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

function LeadsPage() {
  // Query
  const { data: leads } = useQuery({
    queryKey: ['leads'],
    queryFn: () => fetch('/api/leads', { credentials: 'include' }).then(r => r.json()),
  });

  // Mutation
  const createLead = useMutation({
    mutationFn: (data: InsertLead) =>
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  return <div>{/* UI */}</div>;
}
```

#### 4. AI Integration Pattern

**File:** `server/ai/leadResearch.ts`

```typescript
import { genAI } from './config.js'; // Gemini client

export async function researchLead(leadId: number) {
  const lead = await storage.getLeadById(leadId);

  // 1. Gather raw data from multiple sources
  const websiteData = await scrapeWebsite(lead.website);
  const linkedInData = await scrapeLinkedInCompany(lead.companyName);
  const contactLinkedIn = await findLinkedInProfile(lead.contactName);
  const xData = await researchOnX(lead.contactName, lead.companyName);

  // 2. Send to Gemini with grounding (to prevent hallucination)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `
    Analyze this company data and provide a sales intelligence dossier.

    Website Data: ${JSON.stringify(websiteData)}
    LinkedIn Data: ${JSON.stringify(linkedInData)}
    Contact LinkedIn: ${JSON.stringify(contactLinkedIn)}
    X/Twitter Data: ${JSON.stringify(xData)}

    Return JSON with: painPoints, productMatches, talkTracks, discoveryQuestions...
  `;

  const result = await model.generateContent(prompt);
  const dossier = JSON.parse(result.response.text());

  // 3. Save to database with confidence metrics
  await storage.createResearchPacket({
    leadId,
    ...dossier,
    confidence: assessConfidence(dossier),
  });

  // 4. Send notification
  await notificationService.notify(lead.assignedSdrId, {
    type: 'research_complete',
    leadId,
  });

  return dossier;
}
```

**Key Principles:**
- Always ground AI with real data (no hallucination)
- Return structured JSON responses
- Include confidence metrics
- Save all results to database
- Handle errors gracefully

#### 5. WebSocket Pattern

**File:** `server/transcription.ts`

```typescript
import { WebSocketServer } from 'ws';

export function setupTranscriptionWebSocket(server: http.Server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/transcription',
  });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const callSid = url.searchParams.get('callSid');
    const userId = url.searchParams.get('userId');

    // Store connection with metadata
    activeConnections.set(callSid!, { ws, userId, callSid });

    ws.on('message', async (data) => {
      // Process audio chunk, send to speech-to-text
      const transcript = await transcribeAudio(data);

      // Generate coaching tip
      const tip = await generateCoachingTip(transcript, callSid);

      // Send back to client
      ws.send(JSON.stringify({ transcript, tip }));
    });

    ws.on('close', () => {
      activeConnections.delete(callSid!);
    });
  });
}
```

**Client Usage:**
```typescript
// client/src/hooks/use-transcription.ts
export function useTranscription(callSid: string) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:5000/ws/transcription?callSid=${callSid}&userId=${userId}`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTranscripts(prev => [...prev, data.transcript]);
    };

    wsRef.current = ws;

    return () => ws.close();
  }, [callSid]);

  return { transcripts };
}
```

---

## Database Schema & Conventions

### Core Tables

#### users
Primary authentication table with role-based access control.

```typescript
{
  id: number (primary key)
  email: string (unique)
  password: string (bcrypt hashed)
  role: 'admin' | 'manager' | 'sdr' | 'account_specialist' | 'account_executive'
  sdrId: number (nullable, foreign key -> sdrs)
  managerId: number (nullable, foreign key -> managers)
  createdAt: Date
}
```

#### sdrs
Sales Development Representatives.

```typescript
{
  id: number (primary key)
  name: string
  email: string
  phone: string
  managerEmail: string
  managerId: number (foreign key -> managers)
  gender: string
  timezone: string
  createdAt: Date
}
```

#### leads
Sales prospects with qualification tracking.

```typescript
{
  id: number (primary key)
  companyName: string
  contactName: string
  email: string
  phone: string
  linkedIn: string
  website: string
  status: 'new' | 'researching' | 'contacted' | 'engaged' | 'qualified' | 'handed_off' | 'converted' | 'lost'
  fitScore: number (0-100)
  assignedSdrId: number (foreign key -> sdrs)
  assignedAeId: number (nullable, foreign key -> account_executives)
  priority: string
  nextFollowUp: Date
  source: string
  createdAt: Date
  updatedAt: Date
}
```

#### research_packets
AI-generated lead intelligence dossiers.

```typescript
{
  id: number (primary key)
  leadId: number (foreign key -> leads)
  companyIntel: text (large text field)
  contactIntel: text
  painSignals: text
  fitScore: number
  talkTrack: text
  discoveryQuestions: text
  objectionHandles: text
  painPointsJson: jsonb (array of pain point objects)
  productMatchesJson: jsonb (array of product matches)
  linkedInProfileJson: jsonb
  xIntelJson: jsonb
  confidence: string ('high' | 'medium' | 'low')
  createdAt: Date
  updatedAt: Date
}
```

#### call_sessions
Call metadata and recordings.

```typescript
{
  id: number (primary key)
  userId: number (foreign key -> users)
  leadId: number (nullable, foreign key -> leads)
  callSid: string (Twilio call SID)
  direction: 'inbound' | 'outbound'
  fromNumber: string
  toNumber: string
  status: string
  duration: number (seconds)
  recordingUrl: string
  transcriptText: text
  coachingNotes: text
  managerSummary: text
  disposition: string ('connected' | 'voicemail' | 'no_answer' | 'busy')
  keyTakeaways: text
  createdAt: Date
  updatedAt: Date
}
```

#### integration_settings
External CRM integration configuration (Salesforce OAuth tokens).

```typescript
{
  id: number (primary key)
  provider: 'salesforce' | 'hubspot' | 'pipedrive'
  instanceUrl: string (Salesforce instance URL)
  accessToken: string (encrypted OAuth token)
  refreshToken: string (encrypted refresh token)
  expiresAt: timestamp
  metadata: jsonb (provider-specific config)
  createdAt: Date
  updatedAt: Date
}
```

#### salesforce_sync_log
Audit trail for Salesforce lead synchronization.

```typescript
{
  id: number (primary key)
  action: 'import' | 'push' | 'handover'
  leadId: number (foreign key -> leads)
  status: 'pending' | 'success' | 'failed'
  errorMessage: string (nullable)
  syncedAt: timestamp
}
```

#### live_coaching_sessions
Real-time call coaching session tracking.

```typescript
{
  id: number (primary key)
  userId: number (foreign key -> users)
  leadId: number (nullable, foreign key -> leads)
  callSid: string (Twilio call SID)
  status: 'active' | 'completed' | 'abandoned'
  startedAt: Date
  endedAt: Date (nullable)
  createdAt: Date
}
```

#### live_coaching_tips
AI-generated coaching tips during calls.

```typescript
{
  id: number (primary key)
  sessionId: number (foreign key -> live_coaching_sessions)
  tipType: 'suggestion' | 'warning' | 'opportunity'
  content: text
  confidence: number (0-100)
  createdAt: Date
}
```

#### live_transcripts
Real-time call transcription storage.

```typescript
{
  id: number (primary key)
  sessionId: number (foreign key -> live_coaching_sessions)
  speaker: 'agent' | 'customer'
  content: text
  timestamp: Date
  createdAt: Date
}
```

#### navigation_settings
Dynamic UI navigation configuration.

```typescript
{
  id: number (primary key)
  userId: number (foreign key -> users)
  sidebarOrder: jsonb (array of menu item IDs)
  hiddenItems: jsonb (array of hidden menu IDs)
  createdAt: Date
  updatedAt: Date
}
```

### Relationships

```
users ←→ sdrs (one-to-one via sdrId)
users ←→ managers (one-to-one via managerId)
users ←→ navigation_settings (one-to-one)
managers ←→ sdrs (one-to-many)
sdrs ←→ leads (one-to-many via assignedSdrId)
leads ←→ research_packets (one-to-many)
leads ←→ call_sessions (one-to-many)
leads ←→ live_coaching_sessions (one-to-many)
leads ←→ salesforce_sync_log (one-to-many)
call_sessions ←→ manager_call_analyses (one-to-one)
live_coaching_sessions ←→ live_coaching_tips (one-to-many)
live_coaching_sessions ←→ live_transcripts (one-to-many)
```

### Naming Conventions

- **Tables:** Snake case plural (e.g., `call_sessions`, `research_packets`)
- **Columns:** Camel case (e.g., `firstName`, `createdAt`)
- **Foreign Keys:** `{table}Id` (e.g., `leadId`, `sdrId`)
- **Timestamps:** Always include `createdAt`, optionally `updatedAt`
- **JSON Columns:** Suffix with `Json` (e.g., `painPointsJson`)

### Database Operations

```typescript
// INSERT (Drizzle + Zod validation)
const newLead = await storage.createLead({
  companyName: 'Acme Corp',
  contactName: 'John Doe',
  email: 'john@acme.com',
  status: 'new',
  assignedSdrId: 1,
});

// SELECT with relations
const lead = await storage.getLeadById(leadId);
// Returns: { ...lead, research: [...packets], calls: [...sessions] }

// UPDATE
await storage.updateLead(leadId, {
  status: 'qualified',
  fitScore: 85,
});

// DELETE (soft delete preferred)
await storage.updateLead(leadId, { status: 'lost' });

// TRANSACTIONS (use Drizzle directly)
import { db } from './db.js';
await db.transaction(async (tx) => {
  await tx.insert(leads).values({ ... });
  await tx.insert(research_packets).values({ ... });
});
```

---

## API Conventions

### Endpoint Structure

```
/api/{resource}/{action}
/api/{resource}/:id/{action}
```

Examples:
- `GET /api/leads` - List all leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/:id/research` - Trigger research for lead

**Salesforce Integration Endpoints:**
- `GET /api/salesforce/status` - Check connection status
- `GET /api/salesforce/connect` - Get OAuth authorization URL
- `GET /api/salesforce/callback` - OAuth callback handler
- `POST /api/salesforce/disconnect` - Disconnect integration
- `POST /api/salesforce/import` - Import leads from Salesforce
- `POST /api/salesforce/push/:leadId` - Push lead updates to Salesforce
- `POST /api/salesforce/handover/:leadId` - Hand off lead to AE in Salesforce

**AI Reports Endpoints:**
- `GET /api/ai-reports/executive-summary` - Generate executive summary
- `GET /api/ai-reports/performance-trends` - Performance trend analysis
- `GET /api/ai-reports/team-comparison` - Team comparison metrics
- `POST /api/ai-reports/generate` - Generate custom AI report

**Baseline Metrics Endpoints:**
- `GET /api/baseline/metrics` - Get baseline success metrics
- `POST /api/baseline/metrics` - Record new baseline metrics
- `GET /api/baseline/comparison` - Compare against baseline

**Support AI Agent Endpoints:**
- `POST /api/support/chat` - Chat with support AI agent
- `GET /api/support/history` - Get chat history

**Multi-Agent System Endpoints:**
- `POST /api/agents/execute` - Execute agent task
- `GET /api/agents/status/:taskId` - Get task status

**Zoom Integration Endpoints:**
- `GET /api/zoom/recordings` - Get call recordings
- `POST /api/zoom/transcribe/:recordingId` - Transcribe recording

### Request/Response Format

**Request:**
```typescript
// POST /api/leads
{
  companyName: "Acme Corp",
  contactName: "John Doe",
  email: "john@acme.com",
  phone: "+1234567890",
  website: "https://acme.com",
  linkedIn: "https://linkedin.com/company/acme"
}
```

**Response (Success):**
```typescript
// 200 OK
{
  id: 123,
  companyName: "Acme Corp",
  contactName: "John Doe",
  status: "new",
  createdAt: "2026-01-09T12:00:00Z",
  // ... all fields
}
```

**Response (Error):**
```typescript
// 400 Bad Request
{
  message: "Validation failed",
  errors: [
    { field: "email", message: "Invalid email format" }
  ]
}

// 401 Unauthorized
{
  message: "Authentication required"
}

// 403 Forbidden
{
  message: "Insufficient permissions"
}

// 404 Not Found
{
  message: "Lead not found"
}

// 500 Internal Server Error
{
  message: "An error occurred while processing your request"
}
```

### Authentication

All API requests (except `/api/auth/login` and `/api/auth/register`) require authentication.

**Client-Side:**
```typescript
fetch('/api/leads', {
  credentials: 'include', // Include session cookie
})
```

**Server-Side:**
```typescript
app.get('/api/leads', requireAuth, async (req, res) => {
  const userId = req.session!.userId;
  // ...
});
```

### Authorization

Role-based access control using middleware:

```typescript
// Managers and admins only
app.get('/api/manager/oversight',
  requireAuth,
  requireRole('manager', 'admin'),
  async (req, res) => {
    // Handler
  }
);

// SDRs only
app.get('/api/leads/my-leads',
  requireAuth,
  requireRole('sdr'),
  async (req, res) => {
    const user = await storage.getUserById(req.session!.userId);
    const leads = await storage.getLeadsBySdr(user.sdrId!);
    res.json(leads);
  }
);
```

### Error Handling

```typescript
app.post('/api/leads', requireAuth, async (req, res) => {
  try {
    // Validate with Zod
    const validated = insertLeadSchema.parse(req.body);

    // Business logic
    const lead = await storage.createLead(validated);

    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.errors,
      });
    }

    console.error('Error creating lead:', error);
    res.status(500).json({
      message: 'Failed to create lead',
    });
  }
});
```

---

## Frontend Patterns

### Component Structure

```typescript
// Standard component structure
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MyComponent() {
  // 1. Hooks (queries, mutations, state)
  const { data, isLoading } = useQuery({ ... });
  const mutation = useMutation({ ... });
  const [localState, setLocalState] = useState();

  // 2. Event handlers
  const handleClick = () => {
    mutation.mutate({ ... });
  };

  // 3. Render logic
  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <h1>Title</h1>
      <Button onClick={handleClick}>Action</Button>
    </Card>
  );
}
```

### Data Fetching

```typescript
// List query
const { data: leads } = useQuery({
  queryKey: ['leads'],
  queryFn: async () => {
    const res = await fetch('/api/leads', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch leads');
    return res.json();
  },
});

// Detail query
const { data: lead } = useQuery({
  queryKey: ['leads', leadId],
  queryFn: async () => {
    const res = await fetch(`/api/leads/${leadId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch lead');
    return res.json();
  },
  enabled: !!leadId, // Only run if leadId exists
});

// Mutation
const createLead = useMutation({
  mutationFn: async (data: InsertLead) => {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create lead');
    return res.json();
  },
  onSuccess: () => {
    // Invalidate queries to refetch
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    toast({ title: 'Lead created successfully' });
  },
  onError: (error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  },
});

// Usage
<Button onClick={() => createLead.mutate(formData)}>
  {createLead.isPending ? 'Creating...' : 'Create Lead'}
</Button>
```

### Form Handling

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 1. Define schema
const leadFormSchema = z.object({
  companyName: z.string().min(1, 'Company name required'),
  contactName: z.string().min(1, 'Contact name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

// 2. Component
export function LeadForm() {
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      companyName: '',
      contactName: '',
      email: '',
    },
  });

  const createLead = useMutation({ ... });

  const onSubmit = (data: LeadFormData) => {
    createLead.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input
        {...form.register('companyName')}
        placeholder="Company Name"
      />
      {form.formState.errors.companyName && (
        <p className="text-red-500 text-sm">
          {form.formState.errors.companyName.message}
        </p>
      )}

      <Button type="submit" disabled={createLead.isPending}>
        {createLead.isPending ? 'Creating...' : 'Create Lead'}
      </Button>
    </form>
  );
}
```

### Routing

```typescript
// client/src/App.tsx
import { Route, Switch } from 'wouter';
import { useAuth } from '@/lib/auth';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Protected routes */}
      {user ? (
        <>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/leads" component={Leads} />
          <Route path="/coaching" component={Coaching} />

          {/* Manager-only routes */}
          {(user.role === 'manager' || user.role === 'admin') && (
            <>
              <Route path="/team" component={Team} />
              <Route path="/reports" component={Reports} />
            </>
          )}
        </>
      ) : (
        <Route component={() => <Redirect to="/login" />} />
      )}
    </Switch>
  );
}
```

### Styling

**Tailwind CSS Conventions:**
```typescript
// Use Tailwind utility classes
<div className="flex items-center justify-between p-4 bg-card rounded-lg border">
  <h2 className="text-2xl font-bold">Title</h2>
  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Action
  </Button>
</div>

// Use cn() helper for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class"
)}>
  Content
</div>

// Use CSS variables for theming (defined in index.css)
// --background, --foreground, --primary, --secondary, etc.
```

**Component Variants (class-variance-authority):**
```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Usage
<button className={buttonVariants({ variant: 'outline', size: 'lg' })}>
  Click Me
</button>
```

---

## AI Integration Guidelines

### When to Use AI

AI is used for:
1. **Lead Research**: Multi-source intelligence gathering and analysis
2. **Call Coaching**: Real-time coaching tips during calls
3. **Post-Call Analysis**: Transcript analysis and scoring
4. **Manager Insights**: Performance analysis and recommendations
5. **Qualification Extraction**: BANT extraction from transcripts
6. **AI Reports**: Executive summaries, performance trends, team comparisons
7. **Support Chat**: AI-powered support agent for user assistance
8. **Baseline Metrics**: Success tracking and comparison analysis
9. **Disposition Prediction**: Call outcome prediction
10. **Dashboard Insights**: AI-generated dashboard recommendations

### AI Best Practices

#### 1. Always Ground with Real Data

```typescript
// ❌ BAD: Asking AI to guess or hallucinate
const prompt = `Tell me about Acme Corp's pain points.`;

// ✅ GOOD: Providing real data for analysis
const prompt = `
  Analyze the following data about Acme Corp:

  Website Content: ${websiteData}
  LinkedIn Profile: ${linkedInData}
  Recent News: ${newsData}

  Based on this data, identify pain points...
`;
```

#### 2. Request Structured Output

```typescript
// ✅ Request JSON responses
const prompt = `
  Return your analysis as JSON with this structure:
  {
    "painPoints": [{ "title": string, "severity": "high" | "medium" | "low" }],
    "productMatches": [{ "product": string, "relevance": number }],
    "confidence": "high" | "medium" | "low"
  }
`;

const result = await model.generateContent(prompt);
const data = JSON.parse(result.response.text());
```

#### 3. Include Confidence Metrics

```typescript
// Always assess and store confidence
function assessConfidence(dossier: ResearchDossier): string {
  const dataPoints = [
    dossier.companyIntel,
    dossier.linkedInProfileJson,
    dossier.painPointsJson,
  ].filter(Boolean).length;

  if (dataPoints >= 3) return 'high';
  if (dataPoints >= 2) return 'medium';
  return 'low';
}

await storage.createResearchPacket({
  ...dossier,
  confidence: assessConfidence(dossier),
});
```

#### 4. Handle Errors Gracefully

```typescript
try {
  const result = await model.generateContent(prompt);
  const data = JSON.parse(result.response.text());
  return data;
} catch (error) {
  console.error('AI generation failed:', error);

  // Return fallback or partial data
  return {
    painPoints: [],
    confidence: 'low',
    error: 'AI analysis failed',
  };
}
```

#### 5. Use Appropriate Models

**Google Gemini (via @google/generative-ai):**
```typescript
// Fast, cheap tasks (coaching tips, extraction)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000,
  },
});

// Complex reasoning (research, deep analysis)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 4000,
  },
});
```

**Anthropic Claude (via @anthropic-ai/sdk):**
```typescript
// server/ai/claudeClient.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Call coaching analysis (high-quality reasoning)
const response = await anthropic.messages.create({
  model: 'claude-opus-4-20250514',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }],
});

// Extract text from response
const text = response.content
  .filter(block => block.type === 'text')
  .map(block => block.text)
  .join('');
```

**When to use which AI:**
- **Gemini Flash**: Fast tasks, coaching tips, simple extraction
- **Gemini Pro**: Complex research, multi-source analysis
- **Claude Opus**: High-stakes analysis, call coaching, nuanced reasoning

### AI Module Structure

```typescript
// server/ai/myModule.ts
import { genAI } from './config.js';
import { storage } from '../storage.js';

/**
 * Performs AI-powered analysis on X
 * @param input - Input data for analysis
 * @returns Structured analysis result
 */
export async function analyzeX(input: InputType): Promise<ResultType> {
  // 1. Gather raw data
  const rawData = await fetchRawData(input);

  // 2. Build prompt with grounding
  const prompt = buildPrompt(rawData);

  // 3. Call Gemini
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);

  // 4. Parse response
  const data = JSON.parse(result.response.text());

  // 5. Store in database
  await storage.saveAnalysis(data);

  // 6. Return result
  return data;
}

function buildPrompt(rawData: any): string {
  return `
    You are an expert sales analyst...

    Data:
    ${JSON.stringify(rawData, null, 2)}

    Task: Analyze the data and return JSON...
  `;
}
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Define route in appropriate file:**

```typescript
// server/routes.ts or server/leads-routes.ts
app.post('/api/leads/:id/my-action', requireAuth, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const userId = req.session!.userId;

    // Business logic
    const result = await myBusinessLogic(leadId, userId);

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
```

2. **Add storage method if needed:**

```typescript
// server/storage.ts
async getMyData(leadId: number): Promise<MyData[]> {
  return await db.select().from(myTable).where(eq(myTable.leadId, leadId));
}
```

3. **Call from frontend:**

```typescript
// client/src/pages/my-page.tsx
const mutation = useMutation({
  mutationFn: async (leadId: number) => {
    const res = await fetch(`/api/leads/${leadId}/my-action`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data }),
    });
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  },
});
```

### Adding a New Database Table

1. **Define schema in shared/schema.ts:**

```typescript
import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const myTable = pgTable('my_table', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  leadId: integer('lead_id').references(() => leads.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const myTableRelations = relations(myTable, ({ one }) => ({
  lead: one(leads, {
    fields: [myTable.leadId],
    references: [leads.id],
  }),
}));

// Zod schemas
export const insertMyTableSchema = createInsertSchema(myTable);
export const selectMyTableSchema = createSelectSchema(myTable);
export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
export type MyTable = z.infer<typeof selectMyTableSchema>;
```

2. **Push schema to database:**

```bash
npm run db:push
```

3. **Add storage methods:**

```typescript
// server/storage.ts
async createMyRecord(data: InsertMyTable): Promise<MyTable> {
  const [record] = await db.insert(myTable).values(data).returning();
  return record;
}

async getMyRecords(leadId: number): Promise<MyTable[]> {
  return await db.select().from(myTable).where(eq(myTable.leadId, leadId));
}
```

### Adding a New Frontend Page

1. **Create page component:**

```typescript
// client/src/pages/my-page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

export function MyPage() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>My Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Welcome, {user?.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

2. **Add route in App.tsx:**

```typescript
// client/src/App.tsx
import { MyPage } from './pages/my-page';

// Inside <Switch>
<Route path="/my-page" component={MyPage} />
```

3. **Add navigation link:**

```typescript
// client/src/components/app-sidebar.tsx
{
  title: "My Page",
  url: "/my-page",
  icon: IconName,
}
```

### Adding a New AI Module

1. **Create module file:**

```typescript
// server/ai/myAiModule.ts
import { genAI } from './config.js';
import { storage } from '../storage.js';

export async function analyzeWithAI(input: InputType): Promise<OutputType> {
  // Gather data
  const data = await gatherData(input);

  // Build prompt
  const prompt = `
    You are an expert in...

    Data: ${JSON.stringify(data)}

    Task: Analyze and return JSON:
    {
      "field1": ...,
      "field2": ...,
      "confidence": "high" | "medium" | "low"
    }
  `;

  // Call Gemini
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(prompt);

  // Parse and validate
  const output = JSON.parse(result.response.text());

  return output;
}
```

2. **Use in route:**

```typescript
// server/routes.ts
import { analyzeWithAI } from './ai/myAiModule.js';

app.post('/api/analyze/:id', requireAuth, async (req, res) => {
  const result = await analyzeWithAI({ id: req.params.id });
  res.json(result);
});
```

### Debugging Tips

1. **Check database records:**

```typescript
// Add temporary debug endpoint
app.get('/api/debug/leads', requireAuth, async (req, res) => {
  const leads = await db.select().from(leads).limit(10);
  res.json(leads);
});
```

2. **Log AI prompts and responses:**

```typescript
console.log('=== AI PROMPT ===');
console.log(prompt);
const result = await model.generateContent(prompt);
console.log('=== AI RESPONSE ===');
console.log(result.response.text());
```

3. **Check session state:**

```typescript
app.get('/api/debug/session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    userId: req.session?.userId,
    user: req.user,
  });
});
```

4. **Test WebSocket connection:**

```bash
# Use websocat or similar tool
websocat ws://localhost:5000/ws/transcription?callSid=test&userId=1
```

---

## Testing & Debugging

### Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Type check
npm run check

# E2E & UX Testing (Playwright)
npm run test:e2e                    # Run all E2E tests
npm run test:ui                     # Interactive test UI
npm run playwright:screenshot       # Screenshot audit
npm run playwright:accessibility    # Accessibility audit
npm run playwright:flows            # User flow tests
npm run ux:audit-all               # Complete UX audit
```

### Common Issues

#### 1. Database Connection Issues

**Symptom:** `Error: Cannot connect to database`

**Solutions:**
- Check `DATABASE_URL` environment variable
- Ensure PostgreSQL is running (Replit: check database status)
- Run `npm run db:push` to sync schema

#### 2. Authentication Issues

**Symptom:** Redirected to login on every request

**Solutions:**
- Check session cookie is being sent (`credentials: 'include'`)
- Verify `SESSION_SECRET` is set
- Check session table in database: `SELECT * FROM session;`

#### 3. AI Generation Fails

**Symptom:** `Error: AI generation failed`

**Solutions:**
- Check `GEMINI_API_KEY` or Replit AI Integrations config
- Verify prompt is well-formed
- Check for JSON parsing errors
- Add try/catch with fallback data

#### 4. WebSocket Not Connecting

**Symptom:** WebSocket connection closed immediately

**Solutions:**
- Check WebSocket URL format
- Verify query parameters (callSid, userId)
- Check server logs for connection errors
- Test with simpler WebSocket client first

### Logging

```typescript
// Server-side logging
console.log('[INFO]', 'Message');
console.error('[ERROR]', 'Error message', error);
console.warn('[WARN]', 'Warning message');

// Client-side logging
console.log('[CLIENT]', 'Message');

// Structured logging for debugging
console.log(JSON.stringify({ event: 'lead_created', leadId: 123 }, null, 2));
```

---

## Deployment

### Replit Deployment

**Build Command:**
```bash
npm run build
```

**Run Command:**
```bash
node dist/index.cjs
```

**Environment Variables:**
All environment variables must be set in Replit Secrets:
- `DATABASE_URL`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, etc.
- `SERP_API`, `XAI_API`
- `ANTHROPIC_API_KEY` (Claude AI)
- `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_REDIRECT_URI`
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`

### Production Checklist

- [ ] All environment variables set
- [ ] Database schema pushed (`npm run db:push`)
- [ ] Build completes without errors (`npm run build`)
- [ ] Type checking passes (`npm run check`)
- [ ] Test authentication flow
- [ ] Test critical paths (lead research, call coaching)
- [ ] Check error handling in production mode
- [ ] Verify external integrations (Twilio, Google, etc.)

---

## Key Files Reference

### Backend Entry Points

- **`server/index.ts`** - Express app initialization, middleware setup
- **`server/routes.ts`** - Main API routes (50+ endpoints, 3,734 lines)
- **`server/leads-routes.ts`** - Leads-specific routes
- **`server/coach-routes.ts`** - Coaching routes
- **`server/ai-reports-routes.ts`** - AI-generated reports endpoints
- **`server/baseline-routes.ts`** - Success metrics tracking
- **`server/support-routes.ts`** - Support AI agent (1,616 lines)
- **`server/agent-routes.ts`** - Multi-agent system routes
- **`server/salesforce-routes.ts`** - Salesforce integration routes
- **`server/zoom-routes.ts`** - Zoom Phone integration
- **`server/twilio-voice.ts`** - Twilio Voice integration
- **`server/transcription.ts`** - WebSocket transcription
- **`server/dashboardUpdates.ts`** - WebSocket dashboard sync
- **`server/notificationService.ts`** - Real-time notifications
- **`server/pdf-service.ts`** - PDF generation
- **`server/storage.ts`** - Database abstraction layer (772 lines)
- **`server/db.ts`** - Drizzle ORM connection

### Frontend Entry Points

- **`client/src/main.tsx`** - React entry point
- **`client/src/App.tsx`** - Main router and app shell
- **`client/src/lib/auth.tsx`** - Auth context and hooks
- **`client/src/lib/queryClient.ts`** - React Query configuration

### Schema & Types

- **`shared/schema.ts`** - Database schema, Zod validators, TypeScript types (350+ lines)

### AI Modules

- **`server/ai/leadResearch.ts`** - Main lead research orchestrator
- **`server/ai/analyze.ts`** - Post-call analysis
- **`server/ai/coachingAnalysis.ts`** - Live coaching tips (Gemini)
- **`server/ai/callCoachingAnalysis.ts`** - Call coaching analysis (Claude)
- **`server/ai/claudeClient.ts`** - Anthropic Claude SDK wrapper
- **`server/ai/qualificationExtractor.ts`** - BANT extraction from transcripts
- **`server/ai/bantExtraction.ts`** - Alternative BANT extraction
- **`server/ai/managerAnalysis.ts`** - Manager performance analysis
- **`server/ai/reportsAnalysis.ts`** - AI report generation
- **`server/ai/baselineMetrics.ts`** - Success metrics analysis
- **`server/ai/dashboardInsights.ts`** - Dashboard insights generation
- **`server/ai/dispositionSuggestion.ts`** - Call outcome prediction
- **`server/ai/zoomClient.ts`** - Zoom Phone integration
- **`server/ai/browserlessClient.ts`** - Browserless.io integration
- **`server/ai/serpApiClient.ts`** - LinkedIn search API

### Multi-Agent System (Server-side)

- **`server/agents/director.ts`** - Orchestrator agent (12KB)
- **`server/agents/agentExecutor.ts`** - Execution engine
- **`server/agents/promptLoader.ts`** - Prompt management
- **`server/agents/types.ts`** - Type definitions
- **`server/prompts/supportAgent.ts`** - Support chat agent prompt

### Server Helpers

- **`server/helpers/authHelpers.ts`** - Password hashing, session management
- **`server/helpers/leadResearchHelpers.ts`** - Research utilities
- **`server/helpers/managerProfileHelpers.ts`** - Manager analytics
- **`server/helpers/coachingEmailHelpers.ts`** - Email formatting

### Integrations

- **`server/integrations/salesforceClient.ts`** - Salesforce OAuth & REST API
- **`server/integrations/salesforceLeads.ts`** - Lead sync operations

### Configuration Files

- **`package.json`** - Dependencies and scripts (137 packages)
- **`tsconfig.json`** - TypeScript configuration
- **`vite.config.ts`** - Vite build configuration
- **`drizzle.config.ts`** - Drizzle ORM configuration
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`postcss.config.js`** - PostCSS configuration
- **`components.json`** - shadcn/ui configuration
- **`playwright.config.ts`** - Playwright test configuration
- **`.replit`** - Replit environment configuration

### Documentation

- **`CLAUDE.md`** - This file - AI Assistant guide
- **`LEAD_INTEL_TECHNICAL_DOCUMENTATION.md`** - Comprehensive technical documentation
- **`docs/SALESFORCE_INTEGRATION_GUIDE.md`** - Salesforce setup guide
- **`docs/WORKFLOW.md`** - Platform workflow documentation
- **`docs/BASELINE_SUCCESS_METRICS.md`** - Success metrics documentation
- **`docs/SUPPORT_CHAT_GUIDE.md`** - Support chat documentation
- **`docs/discovery/DISCOVERY_QUESTIONNAIRE.md`** - Client discovery questionnaire
- **`docs/discovery/BROWSERLESS_INTEGRATION_SPEC.md`** - Browserless.io integration spec
- **`design_guidelines.md`** - Design system documentation
- **`replit.md`** - Replit setup guide
- **`.claude/agents/README.md`** - Multi-agent system documentation
- **`.claude/ralph/README.md`** - Ralph methodology documentation

---

## Multi-Agent System

### Overview

Lead Intel uses a **multi-agent architecture** with specialized AI agents for different domains:

1. **🎬 Director Agent** - Orchestrates and coordinates all sub-agents
2. **🔍 Researcher Agent** - Deep intelligence gathering and lead research
3. **📊 Business Analyst Agent** - Strategic insights and analytics
4. **🎨 UX Agent** - User experience optimization

### Architecture

```
                    DIRECTOR AGENT 🎬
                    (Orchestration Layer)
                            ↓
         ┌──────────────────┼──────────────────┐
         ↓                  ↓                  ↓
    RESEARCHER 🔍    BUSINESS ANALYST 📊    UX AGENT 🎨
    Intelligence     Strategic Insights   UX Optimization
```

### When to Use Each Agent

**Director Agent** (Your entry point for complex tasks)
```
Use when: Task requires multiple agents or coordination
Example: "Research lead X, analyze fit, and recommend approach"
```

**Researcher Agent**
```
Use when: Need deep lead intelligence or market research
Example: "Research Acme Corp and identify pain points"
Enhances: server/ai/leadResearch.ts
```

**Business Analyst Agent**
```
Use when: Need analytics, insights, or strategic recommendations
Example: "Why is our qualification rate declining?"
Creates: New server/analytics/ module
```

**UX Agent**
```
Use when: Need design improvements or workflow optimization
Example: "Simplify the lead creation flow"
Modifies: client/src/ frontend code
```

### Communication Patterns

**Sequential Workflow:**
```
Researcher → Business Analyst → User
(Research lead → Analyze fit → Present recommendation)
```

**Parallel Workflow:**
```
[Researcher + Business Analyst] → Aggregate → User
(Simultaneous data gathering and analysis)
```

**Feedback Loop:**
```
UX Agent → User Approval → Implementation → Validation
(Design → Approve → Build → Measure)
```

### Human Approval Gates

The Director requires approval for:
- ❌ Database schema changes
- ❌ Deleting data
- ❌ Significant UI changes
- ❌ External API integrations
- ❌ Production deployments

### Agent Files

**Prompt Configurations** (`.claude/agents/`):
- `director.md` - Director Agent prompt
- `researcher.md` - Researcher Agent prompt
- `business-analyst.md` - Business Analyst Agent prompt
- `ux-agent.md` - UX Agent prompt
- `README.md` - Complete multi-agent system guide

**Server-side Implementation** (`server/agents/`):
- `director.ts` - Director orchestrator implementation (12KB)
- `agentExecutor.ts` - Task execution engine
- `promptLoader.ts` - Dynamic prompt loading
- `types.ts` - TypeScript type definitions

**Support Agent** (`server/prompts/`):
- `supportAgent.ts` - Support chat agent prompt definition

### Philosophy

> "The best process is no process. The best tool is no tool unless necessary."

Each agent:
- ✅ Focuses on ONE domain exceptionally well
- ✅ Removes friction before adding features
- ✅ Delivers actionable results, not just data
- ✅ Makes users faster and smarter
- ❌ Adds unnecessary complexity
- ❌ Builds features nobody asked for

### Quick Examples

**Simple Task (Single Agent):**
```
@researcher Find recent news about Tesla relevant to our products
```

**Complex Task (Multi-Agent via Director):**
```
@director Why aren't SDRs using the coaching feature? Diagnose and fix it.

Result: Business Analyst identifies usage issue → UX Agent proposes fixes →
        Director presents integrated solution → User approves → Implementation
```

**Strategic Planning (Full Pipeline):**
```
@director Create a plan to 2x our qualified leads in 90 days

Result: Business Analyst diagnoses bottlenecks → Researcher gathers market intel →
        UX Agent designs improvements → Director presents comprehensive 90-day plan
```

For complete documentation, see `.claude/agents/README.md`

---

## Support AI Agent

### Overview

Lead Intel includes a built-in **Support AI Agent** that provides contextual help and guidance to users. The agent is powered by Gemini AI and has deep knowledge of the platform's features and workflows.

### Key Files

- **`server/support-routes.ts`** - API endpoints (1,616 lines)
- **`server/prompts/supportAgent.ts`** - Agent prompt definition
- **`docs/SUPPORT_CHAT_GUIDE.md`** - User documentation

### API Endpoints

```typescript
// Start or continue support chat
POST /api/support/chat
{
  message: string,
  sessionId?: string,  // Continue existing session
  context?: {
    currentPage: string,
    userRole: string,
  }
}

// Get chat history
GET /api/support/history?sessionId=xxx
```

### Usage Example

```typescript
// Client-side usage
const response = await fetch('/api/support/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    message: 'How do I research a lead?',
    context: {
      currentPage: '/leads',
      userRole: 'sdr',
    },
  }),
});

const { reply, sessionId } = await response.json();
```

### Capabilities

The Support Agent can help with:
- Platform navigation and feature discovery
- Lead research and qualification workflows
- Call coaching and post-call analysis
- Salesforce integration troubleshooting
- Performance metrics interpretation
- Best practices and sales methodology

---

## Ralph Iterative Development

### Overview

**Ralph** is an autonomous AI agent loop methodology that runs fresh agent instances repeatedly until all PRD items are complete. Each iteration starts with clean context, preventing token exhaustion and context pollution.

**Core Principle:** Small tasks + Fresh context + Quality gates + Persistent memory = Reliable iterative development

### How It Works

```
1. Create PRD (prd.json) with small, granular tasks
2. Start feature branch
3. Loop:
   - Get next incomplete task
   - Route to appropriate agent (researcher/analyst/ux/director)
   - Implement with fresh context
   - Run quality gates (typecheck, tests, build)
   - Commit if passes
   - Log learnings to progress.txt
   - Mark task complete in prd.json
4. Repeat until all tasks have passes: true
```

### Key Files

```
.claude/ralph/
├── README.md                    # Full Ralph methodology
├── QUICKSTART.md                # Get started in 5 minutes
├── AGENTS.md                    # Project context for agents
├── progress.txt                 # Learnings log (append-only)
├── prd.json                     # Task registry (auto-generated)
└── templates/
    └── prd-template.json        # PRD structure template
```

### Quick Start

**1. Create PRD:**
```bash
cp .claude/ralph/templates/prd-template.json .claude/ralph/my-feature.json
# Edit my-feature.json with your tasks
```

**2. Run Iteration:**
```bash
# Get next task
STORY_ID=$(jq -r '.stories[] | select(.passes == false) | .id' .claude/ralph/my-feature.json | head -1)
AGENT=$(jq -r ".stories[] | select(.id == \"$STORY_ID\") | .agentType" .claude/ralph/my-feature.json)

# Invoke agent
@$AGENT Implement story: [paste story details]

# Quality gates
npm run check && npm run build

# Commit if passes
git add -A && git commit -m "feat: story complete"

# Mark complete
jq "(.stories[] | select(.id == \"$STORY_ID\") | .passes) = true" .claude/ralph/my-feature.json > tmp.json && mv tmp.json .claude/ralph/my-feature.json
```

**3. Repeat until all tasks complete**

### Benefits

- **Fresh Context:** No token exhaustion or context pollution
- **Quality Gates:** Only working code commits
- **Persistent Memory:** Git + progress.txt + prd.json preserve state
- **Multi-Agent:** Routes tasks to specialist agents automatically
- **Incremental:** Small tasks complete reliably

### Task Sizing

**✅ Right-sized (< 5 acceptance criteria):**
- Add Google News integration module
- Create lead creation UI component
- Implement conversion rate analytics
- Fix accessibility issues on leads page

**❌ Over-sized (will exhaust context):**
- Build entire analytics dashboard
- Implement complete research system
- Redesign all UX
- Create full pipeline from scratch

### Documentation

- **Full Methodology:** `.claude/ralph/README.md`
- **Quick Start Guide:** `.claude/ralph/QUICKSTART.md`
- **Project Context:** `.claude/ralph/AGENTS.md`
- **Original Ralph:** https://github.com/snarktank/ralph

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run check            # Type check
npm run db:push          # Push schema to database

# Production
npm run build            # Build for production
npm start                # Run production server

# Database
npx drizzle-kit generate # Generate migration
npx drizzle-kit push     # Push schema
npx drizzle-kit studio   # Database GUI
```

### Important URLs (Development)

- Frontend: http://localhost:5000
- API: http://localhost:5000/api/*
- WebSocket: ws://localhost:5000/ws/transcription

### Code Style

- **Indent:** 2 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Yes
- **Line Length:** 100 characters (soft limit)
- **File Naming:** kebab-case.ts (e.g., `lead-research.ts`)
- **Component Naming:** PascalCase (e.g., `LeadList.tsx`)

### Git Workflow

```bash
# Standard workflow
git status
git add .
git commit -m "feat: descriptive message"
git push -u origin claude/branch-name-sessionId

# Commit message format
# feat: new feature
# fix: bug fix
# docs: documentation
# refactor: code refactoring
# style: formatting changes
# test: test additions
```

---

## Continuous Reflection & Best Practices

> This section is a **living document**. After every meaningful conversation or implementation session, the AI assistant should reflect on what was learned and update this section with new patterns, pitfalls, and confirmed best practices. This prevents repeating mistakes and builds institutional knowledge across sessions.

### How to Update This Section

At the end of each session (or when a significant insight is gained), the AI should:

1. **Identify** what was confirmed, disproved, or newly discovered
2. **Categorize** the insight (Architecture, AI, Database, Frontend, Workflow, etc.)
3. **Add it below** under the appropriate subsection — concise, actionable entries only
4. **Remove or update** entries that turn out to be incorrect in future sessions

---

### Vibe Coding Sales Engine — Agent Gap Analysis (March 2026)

From exploring the codebase against the "Vibe Coding Strategy" (3-agent SDR automation pipeline):

**Confirmed Architecture State:**
- The **Dossier Agent** is 95% complete — `generateLeadDossier()` in `server/ai/leadResearch.ts` already does multi-source scraping + Claude Opus 4 analysis with hook, talk track, product matching, and fit score
- The **Scrubbing Agent** is 70% complete — scoring logic exists in `leadResearch.ts` but there is no lightweight batch endpoint; full dossier generation is required today (expensive for bulk filtering)
- The **Handoff Agent** is 70% complete — BANT extraction and Salesforce handover work, but there is no Microsoft Teams integration anywhere in the codebase

**Critical Missing Integration:**
- **Microsoft Teams** — No Teams webhook, no Teams Bot, no external notification beyond in-app WebSocket. Gmail exists via `server/google/gmailClient.ts`. Teams Incoming Webhook is the fastest path to fix this.

**Schema Gaps to Remember:**
- `leads` table has no `companyDescription` field (only `companyIndustry` as free text)
- `leads` table has no `disqualificationReason` field
- Research packets have `verificationStatus` (string) but no numeric confidence score
- No agent attribution field — can't tell which AI agent generated which analysis

**Key File Locations (confirmed):**
- Lead dossier generation: `server/ai/leadResearch.ts` (`generateLeadDossier()`)
- BANT extraction: `server/ai/bantExtraction.ts`
- Salesforce handover: `server/integrations/salesforceLeads.ts` (`handoverToSalesforce()`)
- In-app notifications: `server/notificationService.ts`
- Multi-agent director: `server/agents/director.ts`

---

### General Best Practices (Updated Continuously)

**AI Modules:**
- Always use `callClaudeWithRetry()` from `server/ai/claudeClient.ts` — it has retry logic and error handling built in
- Gemini Flash for fast/cheap tasks (coaching tips, simple extraction); Claude Opus for high-stakes analysis (dossier, coaching)
- Always request structured JSON output from AI and wrap `JSON.parse()` in try/catch with a fallback

**Database:**
- Use `getAllLeadsWithResearch()` instead of two separate queries — it's a single optimized JOIN
- Schema changes require `npm run db:push` after editing `shared/schema.ts`
- JSON columns (`dossierJson`, `painPointsJson`, etc.) use `jsonb` type — query with Drizzle's `jsonb` operators for filtering

**Routes:**
- Route files are split by domain: `leads-routes.ts`, `coach-routes.ts`, `salesforce-routes.ts`, `zoom-routes.ts` — add new endpoints to the relevant file, not to the monolithic `routes.ts`
- Always use `requireAuth` middleware; use `requireRole()` for manager/admin-only endpoints

**Frontend:**
- Use `credentials: 'include'` on every `fetch()` call — sessions are cookie-based
- Invalidate React Query cache with `queryClient.invalidateQueries()` after mutations
- Use `cn()` from `@/lib/utils` for conditional Tailwind classes

---

## Support & Resources

### Internal Documentation
- **Technical Documentation:** `LEAD_INTEL_TECHNICAL_DOCUMENTATION.md`
- **Salesforce Integration:** `docs/SALESFORCE_INTEGRATION_GUIDE.md`
- **Platform Workflow:** `docs/WORKFLOW.md`
- **Design Guidelines:** `design_guidelines.md`
- **Replit Setup:** `replit.md`
- **Multi-Agent System:** `.claude/agents/README.md`
- **Ralph Methodology:** `.claude/ralph/README.md`
- **Ralph Quick Start:** `.claude/ralph/QUICKSTART.md`

### External Documentation
- **Drizzle ORM Docs:** https://orm.drizzle.team/
- **React Query Docs:** https://tanstack.com/query/latest
- **Tailwind CSS Docs:** https://tailwindcss.com/
- **shadcn/ui Docs:** https://ui.shadcn.com/
- **Anthropic Claude API:** https://docs.anthropic.com/
- **Salesforce REST API:** https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
- **Playwright Docs:** https://playwright.dev/

---

**End of CLAUDE.md**
