import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Inbox,
  Sparkles,
  User,
  Building2,
  Mail,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Copy,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  ArrowLeft,
} from "lucide-react";

interface EmailAnalysis {
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderDomain: string;
  productsAsked: string[];
  questionsAsked: string[];
  buyerStage: "awareness" | "consideration" | "decision";
  engagementScore: number;
  intent: string;
  urgencySignals: string[];
  suggestedResponse: string;
  escalateToHuman: boolean;
  escalationReason?: string;
}

interface AnalysisResult {
  analysis: EmailAnalysis;
  lead: { id: string; companyName: string; priority: string } | null;
  isNewLead: boolean;
  autoReplySent: boolean;
}

interface InboundActivityThread {
  id: string;
  senderName?: string;
  senderEmail?: string;
  senderCompany?: string;
  fitScore?: number;
  engagementScore?: number;
  productsAsked?: string[];
  intent?: string;
  status?: "ai_active" | "human" | "escalated" | "awaiting_reply";
  lastMessagePreview?: string;
  lastActivityAt?: string;
  subject?: string;
}

interface InboundThreadMessage {
  id: string;
  type?: "prospect" | "ai" | "human";
  from?: string;
  subject?: string;
  body?: string;
  createdAt?: string;
}

// Pre-loaded SalesApe demo scenario
const DEMO_PRESET = {
  from: "Brandon Zahn <brandonz@hawkridgesys.com>",
  subject: "Re: Your AI Sales Rep Demo",
  body: `Hi,

We are an engineering software and hardware solutions provider specializing in CAD software like SOLIDWORKS and CATIA, as well as 3D scanning and printing technology from Markforged, Artek, and Formlabs.

Have you helped customers similar to me?

What are the costs for your solution?

If we trained you on the differences between our products would you be able to tell a customer what they needed based on their questions in an email?

If you get questions like these from a prospect, do you notify a human that you have high engagement?

--
Brandon Zahn | SVP - HRS Software
Hawk Ridge Systems | Office: 208-242-4811 | Mobile: 425-577-2867
www.hawkridgesys.com`,
};

function EngagementBadge({ score }: { score: number }) {
  const config =
    score >= 4
      ? { label: `${score}/5 Hot`, class: "bg-red-500/15 text-red-400 border-red-500/30" }
      : score >= 3
      ? { label: `${score}/5 Warm`, class: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
      : { label: `${score}/5 Cool`, class: "bg-blue-500/15 text-blue-400 border-blue-500/30" };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${config.class}`}>
      <TrendingUp className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const config: Record<string, string> = {
    awareness: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    consideration: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    decision: "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${config[stage] || config.awareness}`}>
      {stage}
    </span>
  );
}

const statusConfig = {
  ai_active: {
    label: "🤖 AI Active",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  human: {
    label: "👤 Human",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  escalated: {
    label: "🚨 Escalated",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  awaiting_reply: {
    label: "⏳ Awaiting reply",
    className: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
} as const;

const formatRelativeTime = (value?: string) => {
  if (!value) return "just now";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getInitials = (name?: string, email?: string) => {
  const base = name?.trim() || email?.trim() || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const truncate = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export default function InboundEmailsPage() {
  const { toast } = useToast();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showRawEmail, setShowRawEmail] = useState(false);
  const [editedResponse, setEditedResponse] = useState("");
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [manualReply, setManualReply] = useState("");
  const [showThreadDetailMobile, setShowThreadDetailMobile] = useState(false);

  // Load inbound email leads queue
  const { data: inboundLeads = [] } = useQuery({
    queryKey: ["inbound-leads"],
    queryFn: () =>
      fetch("/api/inbound/emails", { credentials: "include" }).then((r) => r.json()),
  });

  const {
    data: activity = [],
    isLoading: isLoadingActivity,
  } = useQuery<InboundActivityThread[]>({
    queryKey: ["inbound-activity"],
    queryFn: () => fetch("/api/inbound/activity", { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const {
    data: thread = [],
    isLoading: isLoadingThread,
  } = useQuery<InboundThreadMessage[]>({
    queryKey: ["inbound-thread", selectedThreadId],
    queryFn: () =>
      fetch(`/api/inbound/thread/${selectedThreadId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!selectedThreadId,
    refetchInterval: 15000,
  });

  const selectedThread = useMemo(
    () => activity.find((item) => item.id === selectedThreadId) || null,
    [activity, selectedThreadId],
  );

  const analyzeMutation = useMutation({
    mutationFn: async (payload: { from: string; subject: string; body: string }) => {
      const res = await fetch("/api/inbound/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }
      return res.json() as Promise<AnalysisResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setEditedResponse(data.analysis.suggestedResponse);
      queryClient.invalidateQueries({ queryKey: ["inbound-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: data.isNewLead ? "New lead created" : "Existing lead updated",
        description: `${data.analysis.senderName} at ${data.analysis.senderCompany}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/inbound/email/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: result!.analysis.senderEmail,
          subject: `Re: ${subject || "(no subject)"}`,
          body: editedResponse,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.sent ? "Reply sent" : "Gmail not connected",
        description: data.sent
          ? `Sent to ${result?.analysis.senderEmail}`
          : "Copy the reply and send manually",
      });
    },
  });

  const toggleTakeoverMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!selectedThreadId) return null;
      const res = await fetch(`/api/inbound/thread/${selectedThreadId}/takeover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paused }),
      });
      if (!res.ok) throw new Error("Failed updating thread owner");
      return res.json();
    },
    onSuccess: (_data, paused) => {
      queryClient.invalidateQueries({ queryKey: ["inbound-activity"] });
      queryClient.invalidateQueries({ queryKey: ["inbound-thread", selectedThreadId] });
      toast({
        title: paused ? "Thread taken over" : "AI resumed",
        description: paused ? "Robin is paused for this thread" : "Robin is now handling replies",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const sendManualReplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThread || !manualReply.trim()) return null;
      const res = await fetch("/api/inbound/email/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: selectedThread.senderEmail,
          subject: `Re: ${selectedThread.subject || "(no subject)"}`,
          body: manualReply,
          threadId: selectedThread.id,
        }),
      });
      if (!res.ok) throw new Error("Failed sending manual reply");
      return res.json();
    },
    onSuccess: () => {
      setManualReply("");
      queryClient.invalidateQueries({ queryKey: ["inbound-thread", selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ["inbound-activity"] });
      toast({ title: "Manual reply sent" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  const loadDemo = () => {
    setFrom(DEMO_PRESET.from);
    setSubject(DEMO_PRESET.subject);
    setBody(DEMO_PRESET.body);
    setResult(null);
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(editedResponse);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Inbound Response Agent</h1>
            <p className="text-sm text-muted-foreground">
              Robin analyzes inbound prospect emails and drafts product-specific replies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inboundLeads.length > 0 && (
            <Badge variant="secondary">{inboundLeads.length} inbound leads</Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadDemo}>
            Load SalesApe Demo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Email Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paste Inbound Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                <Input
                  placeholder='John Smith <john@acmecorp.com>'
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                <Input
                  placeholder="Subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Body</label>
                <Textarea
                  placeholder="Paste the full email body here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm resize-none"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => analyzeMutation.mutate({ from, subject, body })}
                disabled={!from || !body || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                    Robin is analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze &amp; Draft Reply
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {!result && !analyzeMutation.isPending && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Inbox className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No analysis yet</p>
                <p className="text-sm mt-1">Paste an email and click Analyze, or load the demo</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Lead card */}
              <Card className={result.analysis.escalateToHuman ? "border-red-500/40" : ""}>
                <CardContent className="pt-4 space-y-3">
                  {/* Escalate banner */}
                  {result.analysis.escalateToHuman && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span><strong>Escalate to SDR</strong> — {result.analysis.escalationReason}</span>
                    </div>
                  )}

                  {/* Sender info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{result.analysis.senderName || result.analysis.senderEmail}</p>
                        <p className="text-xs text-muted-foreground">{result.analysis.senderEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <EngagementBadge score={result.analysis.engagementScore} />
                      {result.isNewLead ? (
                        <Badge variant="secondary" className="text-xs">New Lead</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Existing</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{result.analysis.senderCompany}</span>
                    <span className="text-border">·</span>
                    <Tag className="w-3.5 h-3.5" />
                    <span className="capitalize">{result.analysis.intent}</span>
                    <span className="text-border">·</span>
                    <StageBadge stage={result.analysis.buyerStage} />
                  </div>

                  <Separator />

                  {/* Products & questions */}
                  {result.analysis.productsAsked.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Products mentioned</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.analysis.productsAsked.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.analysis.questionsAsked.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Questions extracted</p>
                      <ul className="space-y-1">
                        {result.analysis.questionsAsked.map((q, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex gap-2">
                            <CheckCircle className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.analysis.urgencySignals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Urgency signals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.analysis.urgencySignals.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Draft reply */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      Robin's Draft Reply
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setIsEditingResponse(!isEditingResponse)}
                    >
                      {isEditingResponse ? "Preview" : "Edit"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditingResponse ? (
                    <Textarea
                      value={editedResponse}
                      onChange={(e) => setEditedResponse(e.target.value)}
                      rows={12}
                      className="text-sm font-mono resize-none"
                    />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 border leading-relaxed max-h-64 overflow-y-auto">
                      {editedResponse}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleCopyResponse}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => sendReplyMutation.mutate()}
                      disabled={sendReplyMutation.isPending}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      {sendReplyMutation.isPending ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Original email toggle */}
              <button
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => setShowRawEmail(!showRawEmail)}
              >
                <span>Original email</span>
                {showRawEmail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRawEmail && (
                <Card>
                  <CardContent className="pt-3">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {body}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbound CRM Inbox</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] min-h-[560px]">
            <div className={`${showThreadDetailMobile ? "hidden lg:block" : "block"} border-r border-border`}>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">Robin&apos;s Inbox</h3>
                <Badge variant="secondary">{activity.length} active threads</Badge>
              </div>
              <ScrollArea className="h-[500px] lg:h-[560px]">
                <div className="divide-y divide-border/70">
                  {isLoadingActivity &&
                    Array.from({ length: 5 }).map((_, idx) => (
                      <div key={idx} className="p-4 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}

                  {!isLoadingActivity && activity.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">No active inbound threads</div>
                  )}

                  {activity.map((item) => {
                    const status = statusConfig[item.status || "awaiting_reply"];
                    return (
                      <button
                        key={item.id}
                        className={`w-full p-4 text-left transition-colors hover:bg-muted/40 ${
                          selectedThreadId === item.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => {
                          setSelectedThreadId(item.id);
                          setShowThreadDetailMobile(true);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9 mt-0.5">
                            <AvatarFallback>{getInitials(item.senderName, item.senderEmail)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{item.senderName || item.senderEmail}</p>
                                <p className="text-xs text-muted-foreground truncate">{item.senderCompany || "Unknown company"}</p>
                              </div>
                              <span className="text-[11px] text-muted-foreground shrink-0">{formatRelativeTime(item.lastActivityAt)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{truncate(item.lastMessagePreview || "No preview", 60)}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className={status.className}>{status.label}</Badge>
                              <Badge variant="outline">Fit {item.fitScore ?? "—"}</Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className={`${showThreadDetailMobile ? "block" : "hidden lg:block"} bg-background`}>
              {!selectedThreadId && (
                <div className="h-full min-h-[560px] flex items-center justify-center text-muted-foreground text-sm px-6">
                  ← Select a thread
                </div>
              )}

              {selectedThreadId && selectedThread && (
                <div className="h-full flex flex-col">
                  <div className="p-4 border-b border-border space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 lg:hidden"
                            onClick={() => setShowThreadDetailMobile(false)}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          <h3 className="font-semibold truncate">{selectedThread.senderName || selectedThread.senderEmail}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {selectedThread.senderCompany || "Unknown company"} · {selectedThread.senderEmail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant="outline">Fit {selectedThread.fitScore ?? "—"}</Badge>
                        <EngagementBadge score={selectedThread.engagementScore ?? 0} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">Products:</span>
                      {selectedThread.productsAsked?.length
                        ? selectedThread.productsAsked.map((product) => (
                            <Badge key={product} variant="outline" className="text-xs">
                              {product}
                            </Badge>
                          ))
                        : "None tagged"}
                      <Separator orientation="vertical" className="h-4" />
                      <span className="font-medium text-foreground">Intent:</span>
                      <Badge variant="secondary" className="capitalize">{selectedThread.intent || "unknown"}</Badge>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 h-[300px] lg:h-[360px] px-4">
                    {isLoadingThread ? (
                      <div className="space-y-3 py-4">
                        <Skeleton className="h-16 w-2/3" />
                        <Skeleton className="h-14 w-1/2 ml-auto" />
                        <Skeleton className="h-20 w-3/4" />
                      </div>
                    ) : (
                      <div className="py-4 space-y-3">
                        {thread.map((message) => {
                          const isProspect = message.type === "prospect";
                          return (
                            <div key={message.id} className={`flex ${isProspect ? "justify-start" : "justify-end"}`}>
                              <div
                                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm border ${
                                  isProspect
                                    ? "bg-muted/50 border-border text-foreground"
                                    : "bg-primary/15 border-primary/30 text-primary-foreground"
                                }`}
                              >
                                <div className="text-xs opacity-80 mb-2">
                                  From: {message.from || (isProspect ? selectedThread.senderEmail : "Robin")}
                                </div>
                                {message.subject && <p className="font-medium mb-2">Subject: {message.subject}</p>}
                                <p className="whitespace-pre-wrap leading-relaxed">{message.body || "(empty message)"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="p-4 border-t border-border space-y-3">
                    {(selectedThread.status || "awaiting_reply") === "human" ? (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => toggleTakeoverMutation.mutate(false)}
                        disabled={toggleTakeoverMutation.isPending}
                      >
                        {toggleTakeoverMutation.isPending ? "Updating..." : "Resume AI"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => toggleTakeoverMutation.mutate(true)}
                        disabled={toggleTakeoverMutation.isPending}
                      >
                        {toggleTakeoverMutation.isPending ? "Updating..." : "Take Over"}
                      </Button>
                    )}

                    <Textarea
                      rows={4}
                      value={manualReply}
                      onChange={(e) => setManualReply(e.target.value)}
                      placeholder="Write a manual reply..."
                      className="resize-none"
                    />
                    <Button
                      className="w-full"
                      onClick={() => sendManualReplyMutation.mutate()}
                      disabled={!manualReply.trim() || sendManualReplyMutation.isPending}
                    >
                      {sendManualReplyMutation.isPending ? "Sending..." : "Send Manual Reply"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
