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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  FlaskConical,
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
  threadId?: string;
  senderName?: string;
  senderEmail?: string;
  company?: string;
  companyName?: string;
  lastMessagePreview?: string;
  snippet?: string;
  lastActivityAt?: string;
  status?: "ai_active" | "human" | "escalated" | "awaiting_reply";
  fitScore?: number;
  engagementScore?: number;
  productsAsked?: string[];
  intent?: string;
}

interface ThreadMessage {
  id?: string;
  role?: "prospect" | "ai" | "human";
  from?: string;
  subject?: string;
  body?: string;
  createdAt?: string;
  timestamp?: string;
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
  const [testEmailOpen, setTestEmailOpen] = useState(false);

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
    queryFn: () =>
      fetch("/api/inbound/activity", { credentials: "include" }).then((r) => r.json()),
    refetchInterval: 30000,
  });

  const {
    data: thread = [],
    isLoading: isLoadingThread,
  } = useQuery<ThreadMessage[]>({
    queryKey: ["inbound-thread", selectedThreadId],
    queryFn: () =>
      fetch(`/api/inbound/thread/${selectedThreadId}`, { credentials: "include" }).then((r) =>
        r.json(),
      ),
    enabled: !!selectedThreadId,
    refetchInterval: 15000,
  });

  const selectedThread = useMemo(
    () => activity.find((item) => (item.threadId || item.id) === selectedThreadId),
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

  const manualReplyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/inbound/email/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: selectedThread?.senderEmail,
          subject: `Re: ${thread[thread.length - 1]?.subject || "(no subject)"}`,
          body: manualReply,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.sent ? "Manual reply sent" : "Gmail not connected",
        description: data.sent
          ? `Sent to ${selectedThread?.senderEmail}`
          : "Copy the reply and send manually",
      });
      if (data.sent) {
        setManualReply("");
      }
      queryClient.invalidateQueries({ queryKey: ["inbound-thread", selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ["inbound-activity"] });
    },
  });

  const takeoverMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      const res = await fetch(`/api/inbound/thread/${selectedThreadId}/takeover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paused }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update thread mode");
      }
      return res.json();
    },
    onSuccess: (_, paused) => {
      toast({
        title: paused ? "AI paused" : "AI resumed",
        description: paused
          ? "You have taken over this thread."
          : "Robin is now handling the thread again.",
      });
      queryClient.invalidateQueries({ queryKey: ["inbound-thread", selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ["inbound-activity"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const formatRelativeTime = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getInitials = (name?: string, email?: string) => {
    if (name?.trim()) {
      return name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
    }
    return email?.[0]?.toUpperCase() || "?";
  };

  const getStatusBadge = (status?: InboundActivityThread["status"]) => {
    switch (status) {
      case "human":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">👤 Human</Badge>;
      case "escalated":
        return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">🚨 Escalated</Badge>;
      case "awaiting_reply":
        return <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30">⏳ Awaiting reply</Badge>;
      case "ai_active":
      default:
        return <Badge className="bg-green-500/15 text-green-400 border-green-500/30">🤖 AI Active</Badge>;
    }
  };

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
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Robin's Inbox</h1>
          <span className="text-xs text-muted-foreground hidden sm:block">hawk.gametime@gmail.com</span>
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 hidden sm:inline-flex">
            🤖 AI Active
          </Badge>
          {activity.length > 0 && (
            <Badge variant="secondary">{activity.length} active threads</Badge>
          )}
        </div>

        <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              Test Email
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                Test Inbound Email
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Email input form */}
              <div className="space-y-3">
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
                    rows={8}
                    className="font-mono text-sm resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadDemo}
                  >
                    Load SalesApe Demo
                  </Button>
                  <Button
                    className="flex-1"
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
                </div>
              </div>

              {/* Analysis results */}
              {result && (
                <div className="space-y-4 border-t pt-4">
                  {/* Lead card */}
                  <Card className={result.analysis.escalateToHuman ? "border-red-500/40" : ""}>
                    <CardContent className="pt-4 space-y-3">
                      {result.analysis.escalateToHuman && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span><strong>Escalate to SDR</strong> — {result.analysis.escalationReason}</span>
                        </div>
                      )}

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
                          rows={10}
                          className="text-sm font-mono resize-none"
                        />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 border leading-relaxed max-h-56 overflow-y-auto">
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
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Full-height 2-panel CRM layout ── */}
      <div className="grid grid-cols-[32%_68%] h-[calc(100vh-57px)] overflow-hidden">

        {/* ── Left: Thread list ── */}
        <div className="border-r border-border flex flex-col overflow-hidden">
          {isLoadingActivity ? (
            <div className="p-3 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 p-6">
              <Inbox className="w-8 h-8 opacity-30" />
              <p>No active threads</p>
              <p className="text-xs text-center opacity-60">Use the "Test Email" button to simulate an inbound email</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {activity.map((item) => {
                  const threadId = item.threadId || item.id;
                  const isActive = selectedThreadId === threadId;
                  return (
                    <button
                      key={threadId}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedThreadId(threadId)}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(item.senderName, item.senderEmail)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-medium truncate">
                              {item.senderName || item.senderEmail || "Unknown sender"}
                            </p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(item.lastActivityAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.company || item.companyName || "Unknown company"}
                          </p>
                          <p className="text-xs truncate text-foreground/70">
                            {(item.lastMessagePreview || item.snippet || "").slice(0, 55)}
                          </p>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            {getStatusBadge(item.status)}
                            <Badge variant="outline" className="text-[10px]">Fit {item.fitScore ?? "-"}</Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* ── Right: Thread detail ── */}
        <div className="flex flex-col overflow-hidden">
          {!selectedThreadId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <ArrowLeft className="w-8 h-8 opacity-20" />
              <p className="text-sm">Select a thread to view the conversation</p>
            </div>
          ) : (
            <>
              {/* Thread detail header */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">
                    {selectedThread?.senderName || selectedThread?.senderEmail || "Thread"}
                  </p>
                  {selectedThread && (
                    <p className="text-xs text-muted-foreground truncate">
                      {(selectedThread.company || selectedThread.companyName || "Unknown company") +
                        " · " +
                        (selectedThread.senderEmail || "")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedThread && (
                    <>
                      <Badge variant="outline" className="text-xs">Fit {selectedThread.fitScore ?? "-"}</Badge>
                      <EngagementBadge score={selectedThread.engagementScore ?? 1} />
                    </>
                  )}
                  {selectedThread?.status === "human" ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs"
                      onClick={() => takeoverMutation.mutate(false)}
                      disabled={takeoverMutation.isPending}
                    >
                      Resume AI
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-500 text-white h-7 text-xs"
                      onClick={() => takeoverMutation.mutate(true)}
                      disabled={takeoverMutation.isPending}
                    >
                      Take Over
                    </Button>
                  )}
                </div>
              </div>

              {/* Product/intent tags */}
              {selectedThread && (selectedThread.productsAsked?.length || selectedThread.intent) && (
                <div className="px-5 py-2 border-b border-border flex flex-wrap gap-1.5 shrink-0">
                  {(selectedThread.productsAsked || []).map((product) => (
                    <Badge key={product} variant="outline" className="text-xs">
                      {product}
                    </Badge>
                  ))}
                  {selectedThread.intent && (
                    <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs capitalize">
                      Intent: {selectedThread.intent}
                    </Badge>
                  )}
                </div>
              )}

              {/* Message bubbles */}
              <div className="flex-1 overflow-hidden">
                {isLoadingThread ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className={cn("h-16 w-3/4", i % 2 === 0 ? "mr-auto" : "ml-auto")} />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-3">
                      {thread.map((message, index) => {
                        const isProspect = message.role === "prospect" || (!message.role && index % 2 === 0);
                        return (
                          <div
                            key={message.id || `${message.timestamp || message.createdAt}-${index}`}
                            className={cn("flex", isProspect ? "justify-start" : "justify-end")}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg border px-3 py-2",
                                isProspect
                                  ? "bg-muted/60 border-border text-foreground"
                                  : "bg-primary/15 border-primary/30 text-primary-foreground",
                              )}
                            >
                              <p className="text-[11px] text-muted-foreground mb-1">
                                {message.from || (isProspect ? "Prospect" : "Robin")} · {message.subject || "(no subject)"}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{message.body || "(empty message)"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Manual reply bar */}
              <div className="border-t border-border p-3 space-y-2 shrink-0">
                <Textarea
                  value={manualReply}
                  onChange={(e) => setManualReply(e.target.value)}
                  placeholder="Write a manual reply..."
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => manualReplyMutation.mutate()}
                    disabled={!manualReply.trim() || manualReplyMutation.isPending}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {manualReplyMutation.isPending ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
