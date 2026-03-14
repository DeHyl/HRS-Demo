import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

  // Load inbound email leads queue
  const { data: inboundLeads = [] } = useQuery({
    queryKey: ["inbound-leads"],
    queryFn: () =>
      fetch("/api/inbound/emails", { credentials: "include" }).then((r) => r.json()),
  });

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

      {/* Inbound leads queue */}
      {inboundLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inbound Lead Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {inboundLeads.map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.contactName}</p>
                      <p className="text-xs text-muted-foreground">{lead.companyName} · {lead.contactEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        lead.priority === "hot"
                          ? "text-red-400 border-red-400/30"
                          : lead.priority === "warm"
                          ? "text-amber-400 border-amber-400/30"
                          : "text-muted-foreground"
                      }
                    >
                      {lead.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Score: {lead.fitScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
