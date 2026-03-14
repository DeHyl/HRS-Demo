import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Phone,
  Mail,
  Building2,
  User,
  Target,
  MessageSquare,
  HelpCircle,
  Shield,
  ArrowLeft,
  Flame,
  Zap,
  TrendingUp,
  Snowflake,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Briefcase,
  ExternalLink,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  Clock
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import type { Lead, ResearchPacket } from "@shared/schema";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function CallPrepPage() {
  const params = useParams<{ leadId: string }>();
  const [, navigate] = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [speedBrief, setSpeedBrief] = useState(false);

  const { data: leadDetail, isLoading } = useQuery<{ lead: Lead; researchPacket: ResearchPacket | null }>({
    queryKey: ["/api/leads", params.leadId],
    enabled: !!params.leadId,
  });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leadDetail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="font-medium">Lead not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  const { lead, researchPacket } = leadDetail;

  const getPriorityDisplay = (priority: string | null) => {
    const config: Record<string, { icon: JSX.Element; color: string; label: string }> = {
      hot: { icon: <Flame className="h-4 w-4" />, color: "text-red-600 bg-red-100 dark:bg-red-900/30", label: "HOT" },
      warm: { icon: <Zap className="h-4 w-4" />, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30", label: "WARM" },
      cool: { icon: <TrendingUp className="h-4 w-4" />, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30", label: "COOL" },
      cold: { icon: <Snowflake className="h-4 w-4" />, color: "text-slate-500 bg-slate-100 dark:bg-slate-800/50", label: "COLD" },
    };
    if (!priority || !config[priority]) return null;
    const { icon, color, label } = config[priority];
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        {icon}
        {label}
      </div>
    );
  };

  const getFitScoreDisplay = (score: number | null) => {
    if (!score) return null;
    const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
    const bg = score >= 70 ? "bg-green-100 dark:bg-green-900/30" : 
               score >= 40 ? "bg-yellow-100 dark:bg-yellow-900/30" : 
               "bg-red-100 dark:bg-red-900/30";
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${bg}`}>
        <Target className={`h-4 w-4 ${color}`} />
        <span className={`font-mono font-bold ${color}`}>{score}</span>
      </div>
    );
  };

  const extractOpeningLine = (talkTrack: string | null) => {
    if (!talkTrack) return null;
    const lines = talkTrack.split('\n');
    const openingIndex = lines.findIndex(l => l.toLowerCase().includes('opening'));
    if (openingIndex >= 0 && openingIndex < lines.length - 1) {
      return lines[openingIndex + 1]?.trim();
    }
    return lines[0]?.replace(/^Opening Line:\s*/i, '').trim();
  };

  const extractTheAsk = (talkTrack: string | null) => {
    if (!talkTrack) return null;
    const lines = talkTrack.split('\n');
    const askIndex = lines.findIndex(l => l.toLowerCase().includes('the ask'));
    if (askIndex >= 0 && askIndex < lines.length - 1) {
      return lines[askIndex + 1]?.trim();
    }
    return null;
  };

  const formatQuestions = (questions: string | null) => {
    if (!questions) return [];
    return questions.split('\n').filter(q => q.trim()).map(q => 
      q.replace(/^\d+\.\s*/, '').trim()
    );
  };

  const openingLine = extractOpeningLine(researchPacket?.talkTrack || null);
  const theAsk = extractTheAsk(researchPacket?.talkTrack || null);
  const questions = formatQuestions(researchPacket?.discoveryQuestions || null);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-muted/30 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
            <span className="text-sm text-muted-foreground font-medium">CALL PREP</span>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="speed-brief" className="text-sm font-medium cursor-pointer">
              {speedBrief ? "⚡ Speed Brief" : "📋 Full View"}
            </label>
            <Switch
              id="speed-brief"
              checked={speedBrief}
              onCheckedChange={setSpeedBrief}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 truncate">{lead.contactName}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{lead.companyName}</span>
              </span>
              {lead.contactTitle && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span className="truncate">{lead.contactTitle}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {getFitScoreDisplay(researchPacket?.fitScore || lead.fitScore)}
            {getPriorityDisplay(researchPacket?.priority || lead.priority)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4">
          {lead.contactPhone && (
            <Button size="sm" className="gap-2 flex-1 sm:flex-none" onClick={() => navigate(`/coaching?phone=${encodeURIComponent(lead.contactPhone || "")}&leadId=${lead.id}`)}>
              <Phone className="h-4 w-4" />
              <span className="truncate">{lead.contactPhone}</span>
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            className="gap-2 flex-1 sm:flex-none min-w-0"
            onClick={() => copyToClipboard(lead.contactEmail, 'email')}
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate hidden sm:inline">{lead.contactEmail}</span>
            <span className="sm:hidden">Email</span>
            {copiedField === 'email' ? <Check className="h-3 w-3 text-green-500 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />}
          </Button>
          {lead.contactLinkedIn && (
            <Button size="sm" variant="outline" className="gap-2 flex-1 sm:flex-none" asChild>
              <a href={lead.contactLinkedIn} target="_blank" rel="noopener noreferrer">
                <SiLinkedin className="h-4 w-4" />
                <span className="hidden sm:inline">LinkedIn</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {!researchPacket ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-1">No Intel Available</p>
                <p className="text-sm text-muted-foreground">
                  Generate a dossier from the Leads page before your call
                </p>
              </CardContent>
            </Card>
          ) : speedBrief ? (
            /* Speed Brief Mode - Essential info only */
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Fit Score - Compact */}
              <div className="text-center py-6">
                <div className={`text-5xl font-bold tracking-tight ${
                  (researchPacket.fitScore || 0) >= 70
                    ? "text-green-600 dark:text-green-400"
                    : (researchPacket.fitScore || 0) >= 40
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {researchPacket.fitScore || 0}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                  Fit Score
                </div>
              </div>

              {/* Opening Line */}
              {openingLine && (
                <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <h3 className="font-bold text-sm uppercase tracking-wide">Opening Line</h3>
                    </div>
                    <p className="text-base leading-relaxed mb-3">{openingLine}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(openingLine, 'opening')}
                    >
                      {copiedField === 'opening' ? (
                        <>
                          <Check className="h-3 w-3 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Top Pain Point */}
              {researchPacket.painSignals && (
                <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <h3 className="font-bold text-sm uppercase tracking-wide">Top Pain Point</h3>
                    </div>
                    <p className="text-sm">
                      {researchPacket.painSignals.split('\n').filter(l => l.trim())[0]?.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '')}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* The Ask */}
              {theAsk && (
                <Card className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-green-600" />
                      <h3 className="font-bold text-sm uppercase tracking-wide">The Ask</h3>
                    </div>
                    <p className="text-base font-medium mb-3">{theAsk}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(theAsk, 'ask')}
                    >
                      {copiedField === 'ask' ? (
                        <>
                          <Check className="h-3 w-3 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold">{questions.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Discovery Qs</p>
                </div>
                <div className="text-center">
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      researchPacket.confidence === "high"
                        ? "bg-green-100 text-green-700"
                        : researchPacket.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {researchPacket.confidence} confidence
                  </Badge>
                </div>
              </div>

              {/* Toggle to Full View */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSpeedBrief(false)}
              >
                View Full Intel
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            /* Full View Mode - All research sections */
            <>
              {/* Hero Fit Score */}
              <div className="text-center py-8">
                <div className="inline-flex flex-col items-center gap-3">
                  <div className={`text-7xl font-bold tracking-tight ${
                    (researchPacket.fitScore || 0) >= 70
                      ? "text-green-600 dark:text-green-400"
                      : (researchPacket.fitScore || 0) >= 40
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {researchPacket.fitScore || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Fit Score
                    </span>
                  </div>
                  {researchPacket.confidence && (
                    <Badge
                      variant="secondary"
                      className={`${
                        researchPacket.confidence === "high"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : researchPacket.confidence === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      } gap-1`}
                    >
                      {researchPacket.confidence === "high" && <CheckCircle className="h-3 w-3" />}
                      {researchPacket.confidence === "medium" && <AlertCircle className="h-3 w-3" />}
                      {researchPacket.confidence === "low" && <AlertTriangle className="h-3 w-3" />}
                      {researchPacket.confidence} confidence
                    </Badge>
                  )}
                </div>
              </div>

              {/* Opening Line - Always Visible */}
              {openingLine && (
                <Card className="border-0 shadow-sm bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">Opening Line</h3>
                    </div>
                    <p className="text-base leading-relaxed">{openingLine}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() => copyToClipboard(openingLine, 'opening')}
                    >
                      {copiedField === 'opening' ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* BANT Qualification - Always Visible */}
              {(lead.budget || lead.decisionMakers || lead.timeline) && (
                <Card className="border-0 shadow-sm bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-lg">BANT Qualification</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {lead.budget && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span className="uppercase tracking-wide">Budget</span>
                          </div>
                          <p className="text-sm font-medium">{lead.budget}</p>
                        </div>
                      )}
                      {lead.timeline && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="uppercase tracking-wide">Timeline</span>
                          </div>
                          <p className="text-sm font-medium">{lead.timeline}</p>
                        </div>
                      )}
                      {lead.decisionMakers && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span className="uppercase tracking-wide">Decision Makers</span>
                          </div>
                          <p className="text-sm font-medium">{lead.decisionMakers}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Progressive Disclosure Accordion */}
              <Accordion type="multiple" defaultValue={["pain", "questions"]} className="space-y-3">
                {/* Pain Points */}
                {researchPacket.painSignals && (
                  <AccordionItem value="pain" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="font-semibold text-base">Pain Points</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <CompactText content={researchPacket.painSignals} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Discovery Questions */}
                {questions.length > 0 && (
                  <AccordionItem value="questions" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30">
                          <HelpCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="font-semibold text-base">Discovery Questions</span>
                        <Badge variant="secondary" className="ml-auto mr-4">{questions.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <div className="space-y-2">
                        {questions.map((q, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors duration-200">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <p className="text-sm pt-0.5">{q}</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Product Fit */}
                {researchPacket.fitAnalysis && (
                  <AccordionItem value="fit" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                          <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="font-semibold text-base">Product Fit Analysis</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <CompactText content={researchPacket.fitAnalysis} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Company Intel */}
                {researchPacket.companyIntel && (
                  <AccordionItem value="company" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                          <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <span className="font-semibold text-base">Company Intel</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <CompactText content={researchPacket.companyIntel} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Contact Intel */}
                {researchPacket.contactIntel && (
                  <AccordionItem value="contact" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-cyan-100 dark:bg-cyan-900/30">
                          <User className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <span className="font-semibold text-base">Contact Intel</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <CompactText content={researchPacket.contactIntel} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Objection Handles */}
                {researchPacket.objectionHandles && (
                  <AccordionItem value="objections" className="border-0 shadow-sm rounded-lg bg-card">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 rounded-lg transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
                          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="font-semibold text-base">Objection Handles</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <CompactText content={researchPacket.objectionHandles} />
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              {/* The Ask - Always Visible */}
              {theAsk && (
                <Card className="border-0 shadow-sm bg-green-50/50 dark:bg-green-950/20 border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-lg">The Ask</h3>
                    </div>
                    <p className="text-base font-medium">{theAsk}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() => copyToClipboard(theAsk, 'ask')}
                    >
                      {copiedField === 'ask' ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CompactText({ content, lines = 6 }: { content: string | null; lines?: number }) {
  if (!content) return null;

  const textLines = content.split('\n').filter(l => l.trim());
  const displayLines = textLines.slice(0, lines);
  
  return (
    <div className="space-y-1 text-sm">
      {displayLines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          return (
            <p key={i} className="font-semibold text-sm mt-3 mb-1 text-foreground border-b border-border/50 pb-0.5">
              {trimmed.replace(/^#+\s*/, '')}
            </p>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed)) {
          const cleanText = trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
          return (
            <div key={i} className="flex items-start gap-2">
              <ChevronRight className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
              <span className="text-foreground/90">{cleanText}</span>
            </div>
          );
        }
        if (trimmed.endsWith(':') && trimmed.length < 50) {
          return <p key={i} className="font-medium mt-2 text-foreground">{trimmed}</p>;
        }
        return <p key={i} className="text-foreground/90">{trimmed}</p>;
      })}
      {textLines.length > lines && (
        <p className="text-muted-foreground text-xs mt-2">
          +{textLines.length - lines} more lines...
        </p>
      )}
    </div>
  );
}
