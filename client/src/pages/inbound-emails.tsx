import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Inbox,
  TrendingUp,
  Send,
  RefreshCw,
} from "lucide-react";

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
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [manualReply, setManualReply] = useState("");

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Robin's Inbox</h1>
            <p className="text-xs text-muted-foreground leading-tight hidden sm:block">
              hawk.gametime@gmail.com — AI responding automatically
            </p>
          </div>
          <Badge className="bg-green-500/15 text-green-400 border-green-500/30 hidden sm:inline-flex">
            🤖 AI Active
          </Badge>
          {activity.length > 0 && (
            <Badge variant="secondary">{activity.length} active thread{activity.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 opacity-50" />
          <span className="hidden sm:inline">Refreshes every 30s</span>
        </div>
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
              <div className="animate-pulse">
                <Inbox className="w-10 h-10 opacity-25" />
              </div>
              <p className="text-sm font-medium">Waiting for inbound emails...</p>
              <p className="text-xs text-center opacity-50">Robin will process them automatically as they arrive</p>
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
              <Inbox className="w-10 h-10 opacity-20" />
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
                <div className="shrink-0">
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

              {/* ── Analysis strip ── */}
              {selectedThread && (
                <div className="px-5 py-2.5 border-b border-border bg-muted/20 flex flex-wrap items-center gap-2 shrink-0">
                  <EngagementBadge score={selectedThread.engagementScore ?? 1} />
                  {getStatusBadge(selectedThread.status)}
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
                  {selectedThread.fitScore != null && (
                    <Badge variant="secondary" className="text-xs">
                      Fit {selectedThread.fitScore}/10
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
