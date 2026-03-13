import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  User, 
  Loader2,
  ExternalLink,
  Target,
  MessageSquare,
  Shield,
  Upload,
  AlertTriangle,
  TrendingUp,
  Globe,
  Clock,
  Crosshair,
  Flame,
  Zap,
  Snowflake,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  MapPin,
  Users,
  DollarSign,
  Award,
  HelpCircle,
  Sparkles,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  ListFilter,
  Plus,
  ArrowRight,
  LayoutList,
  CheckCircle2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Pencil,
  Save,
  X,
  Edit2,
  Check,
  Link2,
  FileText,
  Copy
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiLinkedin, SiX } from "react-icons/si";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LeadActivityTimeline } from "@/components/lead-activity-timeline";
import type { Lead, ResearchPacket, CallSession } from "@shared/schema";

interface LeadWithResearch extends Lead {
  hasResearch: boolean;
  researchStatus: string | null;
}

type SortField = "score" | "name" | "company";
type SortDirection = "asc" | "desc";
export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadWithResearch | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showProspectorModal, setShowProspectorModal] = useState(false);
  const [prospectorForm, setProspectorForm] = useState({
    industry: "Aerospace & Defense",
    location: "",
    companySize: "",
    contactTitle: "Engineering Manager",
    keywords: "",
    maxResults: 15,
    minFitScore: 60,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hideGenericEmails, setHideGenericEmails] = useState(false);
  const [showQualifyDialog, setShowQualifyDialog] = useState(false);
  const [qualifyData, setQualifyData] = useState({
    qualificationNotes: "",
    buySignals: "",
    budget: "",
    timeline: "",
    decisionMakers: ""
  });
  const [qualifyDraftFetched, setQualifyDraftFetched] = useState(false);
  const { toast } = useToast();

  const genericDomains = useMemo(() => ["gmail.com", "hotmail.com", "live.com", "outlook.com", "yahoo.com", "aol.com", "icloud.com", "mail.com", "protonmail.com", "zoho.com"], []);
  const isGenericEmail = useCallback((email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    return genericDomains.includes(domain);
  }, [genericDomains]);
  const [, navigate] = useLocation();

  const { data: leads = [], isLoading } = useQuery<LeadWithResearch[]>({
    queryKey: ["/api/leads"],
  });

  const researchedLeads = leads.filter(l => l.hasResearch);
  const avgScore = researchedLeads.length > 0 
    ? Math.round(researchedLeads.reduce((sum, l) => sum + (l.fitScore || 0), 0) / researchedLeads.length)
    : 0;
  const hotLeads = leads
    .filter(l => l.hasResearch && l.fitScore && l.fitScore >= 70)
    .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
    .slice(0, 5);

  const { data: leadDetail, isLoading: detailLoading } = useQuery<{ lead: Lead; researchPacket: ResearchPacket | null }>({
    queryKey: ["/api/leads", selectedLead?.id],
    enabled: !!selectedLead,
  });

  interface QualificationDraft {
    qualificationNotes: string;
    buySignals: string;
    budget: string;
    timeline: string;
    decisionMakers: string;
    source: "call_transcript" | "no_data";
    confidence: "high" | "medium" | "low";
    message?: string;
  }

  const { data: qualificationDraft, isLoading: draftLoading, refetch: refetchDraft } = useQuery<QualificationDraft>({
    queryKey: ["/api/leads", selectedLead?.id, "qualification-draft"],
    enabled: showQualifyDialog && !!selectedLead && !qualifyDraftFetched,
  });

  useEffect(() => {
    if (qualificationDraft && showQualifyDialog && !qualifyDraftFetched) {
      setQualifyData({
        qualificationNotes: qualificationDraft.qualificationNotes || "",
        buySignals: qualificationDraft.buySignals || "",
        budget: qualificationDraft.budget || "",
        timeline: qualificationDraft.timeline || "",
        decisionMakers: qualificationDraft.decisionMakers || ""
      });
      setQualifyDraftFetched(true);
      if (qualificationDraft.source === "call_transcript" && qualificationDraft.confidence !== "low") {
        toast({ 
          title: "AI Suggestions Loaded", 
          description: "Fields pre-filled from call transcript. Review and edit as needed." 
        });
      }
    }
  }, [qualificationDraft, showQualifyDialog, qualifyDraftFetched, toast]);

  useEffect(() => {
    if (!showQualifyDialog) {
      setQualifyDraftFetched(false);
    }
  }, [showQualifyDialog]);

  const researchMutation = useMutation({
    mutationFn: async ({ leadId, refresh = false, mode = 'fast' }: { leadId: string; refresh?: boolean; mode?: 'fast' | 'deep' }) => {
      const url = refresh
        ? `/api/leads/${leadId}/research?refresh=true`
        : `/api/leads/${leadId}/research`;
      const res = await apiRequest("POST", url, { mode });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLead?.id] });
      const modeLabel = data?.researchMode === 'deep' ? 'Deep Intel' : 'Intel';
      toast({ title: `${modeLabel} Gathered`, description: "Lead dossier compiled successfully" });
    },
    onError: () => {
      toast({ title: "Intel Failed", description: "Could not compile lead dossier", variant: "destructive" });
    },
  });

  const scrubMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agents/scrub/bulk", {
        filter: { status: "new" },
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: `Scrub complete — ${data.processed} leads scored`,
        description: `${data.qualified} qualified (${data.byPriority?.hot ?? 0} hot, ${data.byPriority?.warm ?? 0} warm) · ${data.disqualified} disqualified · avg score ${data.avgFitScore}`,
      });
    },
    onError: () => {
      toast({ title: "Scrub failed", description: "Could not score leads", variant: "destructive" });
    },
  });

  const prospectorMutation = useMutation({
    mutationFn: async (form: typeof prospectorForm) => {
      const res = await apiRequest("POST", "/api/agents/prospect", {
        criteria: {
          industry: form.industry,
          location: form.location || undefined,
          companySize: form.companySize || undefined,
          contactTitle: form.contactTitle || undefined,
          keywords: form.keywords ? form.keywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
          maxResults: form.maxResults,
          minFitScore: form.minFitScore,
        },
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setShowProspectorModal(false);
      toast({
        title: `Prospector complete — ${data.inserted} new leads added`,
        description: `Discovered ${data.discovered} companies · ${data.qualified} qualified · ${data.skipped} skipped`,
      });
    },
    onError: () => {
      toast({ title: "Prospector failed", description: "Could not find leads", variant: "destructive" });
    },
  });

  const aiHandoffMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/agents/handoff/${leadId}`, {
        pushToSalesforce: true,
        convertToOpportunity: false,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: `AI Handoff complete — ${data.companyName}`,
        description: [
          data.productInterests?.length ? `Products: ${data.productInterests.map((p: { productName: string }) => p.productName).join(', ')}` : null,
          data.budget ? `Budget: ${data.budget}` : null,
          data.salesforcePushed ? 'Pushed to Salesforce ✓' : null,
        ].filter(Boolean).join(' · '),
      });
    },
    onError: () => {
      toast({ title: "AI Handoff failed", description: "Could not complete handoff", variant: "destructive" });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: typeof qualifyData }) => {
      const res = await apiRequest("PATCH", `/api/leads/${leadId}`, {
        status: "qualified",
        qualificationNotes: data.qualificationNotes || null,
        buySignals: data.buySignals || null,
        budget: data.budget || null,
        timeline: data.timeline || null,
        decisionMakers: data.decisionMakers || null,
        handedOffAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", selectedLead?.id] });
      setShowQualifyDialog(false);
      setQualifyData({ qualificationNotes: "", buySignals: "", budget: "", timeline: "", decisionMakers: "" });
      toast({ title: "Lead Qualified", description: "Lead marked as qualified and ready for AE handoff" });
    },
    onError: () => {
      toast({ title: "Handoff Failed", description: "Could not update lead status", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selectedLead && leads.length > 0) {
      const updatedLead = leads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    }
  }, [leads, selectedLead?.id]);

  const filteredLeads = useMemo(() => {
    return leads
      .filter(lead => {
        if (hideGenericEmails && isGenericEmail(lead.contactEmail)) {
          return false;
        }
        return lead.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.contactEmail.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "score":
            comparison = (a.fitScore || 0) - (b.fitScore || 0);
            break;
          case "name":
            comparison = a.contactName.localeCompare(b.contactName);
            break;
          case "company":
            comparison = a.companyName.localeCompare(b.companyName);
            break;
        }
        return sortDirection === "desc" ? -comparison : comparison;
      });
  }, [leads, searchQuery, hideGenericEmails, sortField, sortDirection, isGenericEmail]);

  const handleCallLead = (lead: LeadWithResearch) => {
    navigate(`/coaching?phone=${encodeURIComponent(lead.contactPhone || "")}&leadId=${lead.id}`);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" data-testid="heading-leads">Lead Intel Database</h1>
            <p className="text-xs text-muted-foreground">
              {leads.length} records | {leads.filter(l => l.hasResearch).length} researched
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddLeadModal(true)} data-testid="button-add-lead">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} data-testid="button-import-leads">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrubMutation.mutate()}
            disabled={scrubMutation.isPending}
            data-testid="button-scrub-leads"
          >
            {scrubMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {scrubMutation.isPending ? "Scrubbing..." : "Scrub New"}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowProspectorModal(true)}
            disabled={prospectorMutation.isPending}
            data-testid="button-prospect-leads"
          >
            {prospectorMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {prospectorMutation.isPending ? "Searching..." : "Find Leads"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`border-r flex flex-col bg-muted/30 transition-all duration-200 ${sidebarCollapsed ? "w-12" : "w-80"}`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center py-3">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                data-testid="button-expand-sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="mt-4 text-xs font-mono text-muted-foreground writing-mode-vertical transform rotate-180" style={{ writingMode: "vertical-rl" }}>
                {leads.length} leads
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Stats</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSidebarCollapsed(true)}
                    aria-label="Collapse sidebar"
                    data-testid="button-collapse-sidebar"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-background rounded-md p-2 border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Database className="h-3 w-3" />
                      Researched
                    </div>
                    <div className="text-lg font-bold">{researchedLeads.length}<span className="text-xs text-muted-foreground font-normal">/{leads.length}</span></div>
                  </div>
                  <div className="bg-background rounded-md p-2 border">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <BarChart3 className="h-3 w-3" />
                      Avg Score
                    </div>
                    <div className={`text-lg font-bold font-mono ${avgScore >= 70 ? "text-green-600 dark:text-green-400" : avgScore >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                      {researchedLeads.length > 0 ? avgScore : "-"}
                    </div>
                  </div>
                </div>

                {hotLeads.length > 0 && (
                  <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-md p-2 border border-red-500/20 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                      <Flame className="h-3 w-3" />
                      Hot Leads - Call Next
                    </div>
                    <div className="space-y-1">
                      {hotLeads.map(lead => (
                        <button
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`w-full text-left px-2 py-1 rounded text-xs hover-elevate flex items-center justify-between gap-2 ${selectedLead?.id === lead.id ? "bg-red-500/20" : ""}`}
                          data-testid={`button-hot-lead-${lead.id}`}
                        >
                          <span className="truncate">{lead.contactName}</span>
                          <span className="font-mono font-bold text-green-600 dark:text-green-400">{lead.fitScore}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-background"
                    data-testid="input-search-leads"
                  />
                </div>
              </div>

              <div className="p-2 border-b flex items-center gap-2">
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs flex-1" data-testid="select-sort-field">
                    <ListFilter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
                  aria-label={sortDirection === "desc" ? "Sort ascending" : "Sort descending"}
                  data-testid="button-toggle-sort-direction"
                >
                  {sortDirection === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant={hideGenericEmails ? "default" : "ghost"}
                  onClick={() => setHideGenericEmails(h => !h)}
                  aria-label={hideGenericEmails ? "Show all emails" : "Hide generic emails"}
                  title="Hide Gmail, Hotmail, Yahoo, etc."
                  data-testid="button-toggle-generic-emails"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </div>

              {/* Results count and clear filters bar */}
              {!isLoading && (
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {filteredLeads.length === leads.length ? (
                      <>{leads.length} {leads.length === 1 ? 'lead' : 'leads'}</>
                    ) : (
                      <>{filteredLeads.length} of {leads.length} {leads.length === 1 ? 'lead' : 'leads'}</>
                    )}
                  </span>
                  {(searchQuery || hideGenericEmails || sortField !== "score" || sortDirection !== "desc") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        setSearchQuery("");
                        setHideGenericEmails(false);
                        setSortField("score");
                        setSortDirection("desc");
                      }}
                      data-testid="button-clear-filters"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear filters
                    </Button>
                  )}
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                      <Search className="h-8 w-8 mb-2 opacity-40" />
                      <p className="font-medium">No leads match your filters</p>
                      {searchQuery && (
                        <p className="text-xs mt-1">Try a different search term</p>
                      )}
                      {(searchQuery || hideGenericEmails) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            setSearchQuery("");
                            setHideGenericEmails(false);
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredLeads.map((lead) => (
                      <LeadListItem
                        key={lead.id}
                        lead={lead}
                        isSelected={selectedLead?.id === lead.id}
                        onClick={() => setSelectedLead(lead)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-background">
          {selectedLead ? (
            <LeadDetailPanel
              lead={selectedLead}
              detail={leadDetail}
              isLoading={detailLoading}
              onResearch={() => researchMutation.mutate({ leadId: selectedLead.id, refresh: selectedLead.hasResearch, mode: 'fast' })}
              onDeepResearch={() => researchMutation.mutate({ leadId: selectedLead.id, refresh: true, mode: 'deep' })}
              isResearching={researchMutation.isPending}
              onCall={() => handleCallLead(selectedLead)}
              onHandoff={() => setShowQualifyDialog(true)}
              isHandingOff={handoffMutation.isPending}
              onAiHandoff={() => aiHandoffMutation.mutate(selectedLead.id)}
              isAiHandingOff={aiHandoffMutation.isPending}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Database className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Select a lead to view intel</p>
                <p className="text-sm mt-1">Click on any record in the list</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
      <AddLeadModal open={showAddLeadModal} onOpenChange={setShowAddLeadModal} />

      {/* Prospector Agent Modal */}
      <Dialog open={showProspectorModal} onOpenChange={setShowProspectorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Find New Leads
            </DialogTitle>
            <DialogDescription>
              The Prospector Agent searches Google and LinkedIn for companies that match your criteria, scrapes their websites, and adds qualified leads automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Industry *</label>
              <Input
                value={prospectorForm.industry}
                onChange={e => setProspectorForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="e.g. Aerospace Manufacturing"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={prospectorForm.location}
                onChange={e => setProspectorForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. California, United States"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Company Size</label>
                <Input
                  value={prospectorForm.companySize}
                  onChange={e => setProspectorForm(f => ({ ...f, companySize: e.target.value }))}
                  placeholder="e.g. 50-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Min Fit Score</label>
                <Input
                  type="number"
                  min={0} max={100}
                  value={prospectorForm.minFitScore}
                  onChange={e => setProspectorForm(f => ({ ...f, minFitScore: parseInt(e.target.value) || 60 }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Target Title</label>
              <Input
                value={prospectorForm.contactTitle}
                onChange={e => setProspectorForm(f => ({ ...f, contactTitle: e.target.value }))}
                placeholder="e.g. Engineering Manager, VP Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Keywords <span className="text-muted-foreground font-normal">(comma separated)</span></label>
              <Input
                value={prospectorForm.keywords}
                onChange={e => setProspectorForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="e.g. SolidWorks, Creo, CAD design"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max Results</label>
              <Input
                type="number"
                min={1} max={50}
                value={prospectorForm.maxResults}
                onChange={e => setProspectorForm(f => ({ ...f, maxResults: parseInt(e.target.value) || 15 }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => prospectorMutation.mutate(prospectorForm)}
                disabled={prospectorMutation.isPending || !prospectorForm.industry}
              >
                {prospectorMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Prospecting...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Start Prospecting
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowProspectorModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showQualifyDialog} onOpenChange={setShowQualifyDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Qualify Lead for AE Handoff
            </DialogTitle>
            <DialogDescription>
              Capture key qualification details before sending to the Account Executive team.
            </DialogDescription>
          </DialogHeader>
          
          {draftLoading && !qualifyDraftFetched ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing call transcript...</p>
              </div>
            </div>
          ) : (
          <>
          <div className="space-y-4 py-4">
            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Smart Handoff Assistant</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetchDraft();
                  setQualifyDraftFetched(false);
                }}
                className="gap-1 text-xs"
                data-testid="button-refresh-suggestions"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh AI Suggestions
              </Button>
            </div>

            {qualificationDraft?.source === "call_transcript" && qualificationDraft?.confidence !== "low" && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs text-green-700 dark:text-green-300">AI suggestions from call transcript - edit as needed</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="qual-notes">Qualification Notes</Label>
              <Textarea
                id="qual-notes"
                placeholder="Key discoveries from your conversations..."
                value={qualifyData.qualificationNotes}
                onChange={(e) => setQualifyData(prev => ({ ...prev, qualificationNotes: e.target.value }))}
                className="min-h-[80px]"
                data-testid="input-qualification-notes"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="buy-signals">Buy Signals Observed</Label>
              <Textarea
                id="buy-signals"
                placeholder="Pain points expressed, urgency indicators, competitive mentions..."
                value={qualifyData.buySignals}
                onChange={(e) => setQualifyData(prev => ({ ...prev, buySignals: e.target.value }))}
                className="min-h-[60px]"
                data-testid="input-buy-signals"
              />
            </div>

            <Separator className="my-4" />

            {/* BANT Auto-Fill Section */}
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-semibold">Auto-Fill BANT from Call</h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!selectedLead) return;

                    // Find the most recent call with a transcript
                    const callsQuery = await queryClient.fetchQuery({
                      queryKey: ["/api/call-sessions"],
                    });

                    const recentCallWithTranscript = (callsQuery as CallSession[])
                      .filter((call) => call.leadId === selectedLead.id && call.transcriptText && call.transcriptText.trim().length >= 100)
                      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())[0];

                    if (!recentCallWithTranscript) {
                      toast({
                        title: "No Call Found",
                        description: "No recent call with transcript found for this lead",
                        variant: "destructive",
                      });
                      return;
                    }

                    try {
                      const res = await fetch(`/api/call-sessions/${recentCallWithTranscript.id}/extract-bant`, {
                        method: 'POST',
                        credentials: 'include',
                      });

                      if (!res.ok) throw new Error('Failed to extract BANT');

                      const result = await res.json();
                      const bant = result.data;

                      // Auto-fill the BANT fields
                      setQualifyData(prev => ({
                        ...prev,
                        budget: bant.budget || prev.budget,
                        timeline: bant.timeline || prev.timeline,
                        decisionMakers: bant.decisionMakers || prev.decisionMakers,
                      }));

                      toast({
                        title: "BANT Extracted",
                        description: bant.extractionSummary,
                      });
                    } catch (error) {
                      toast({
                        title: "Extraction Failed",
                        description: "Could not extract BANT from call transcript",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="gap-1"
                  data-testid="button-extract-bant"
                >
                  <Sparkles className="h-3 w-3" />
                  Extract from Call
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically extract Budget, Authority, Need, and Timeline from your most recent call transcript
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Input
                  id="budget"
                  placeholder="e.g., $50K-$100K"
                  value={qualifyData.budget}
                  onChange={(e) => setQualifyData(prev => ({ ...prev, budget: e.target.value }))}
                  data-testid="input-budget"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Input
                  id="timeline"
                  placeholder="e.g., Q2 2025"
                  value={qualifyData.timeline}
                  onChange={(e) => setQualifyData(prev => ({ ...prev, timeline: e.target.value }))}
                  data-testid="input-timeline"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="decision-makers">Decision Makers Identified</Label>
              <Input
                id="decision-makers"
                placeholder="Names, titles, and roles..."
                value={qualifyData.decisionMakers}
                onChange={(e) => setQualifyData(prev => ({ ...prev, decisionMakers: e.target.value }))}
                data-testid="input-decision-makers"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowQualifyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedLead) {
                  handoffMutation.mutate({ leadId: selectedLead.id, data: qualifyData });
                }
              }}
              disabled={handoffMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-qualify"
            >
              {handoffMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Qualify and Hand Off
            </Button>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadListItem({ 
  lead, 
  isSelected, 
  onClick 
}: { 
  lead: LeadWithResearch; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const getPriorityIcon = (priority: string | null) => {
    switch (priority) {
      case "hot": return <Flame className="h-3 w-3 text-red-500" />;
      case "warm": return <Zap className="h-3 w-3 text-orange-500" />;
      case "cool": return <TrendingUp className="h-3 w-3 text-blue-500" />;
      case "cold": return <Snowflake className="h-3 w-3 text-slate-400" />;
      default: return null;
    }
  };

  const getFitScoreColor = (score: number | null) => {
    if (score === null || score === undefined) return "text-muted-foreground";
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getLastContactInfo = (lastContactedAt: Date | null) => {
    if (!lastContactedAt) return null;

    const now = new Date();
    const lastContact = new Date(lastContactedAt);
    const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));

    let color = "text-muted-foreground";
    let icon = Clock;

    if (daysSince === 0) {
      return { text: "Today", color: "text-green-600 dark:text-green-400", icon };
    } else if (daysSince === 1) {
      return { text: "Yesterday", color: "text-green-600 dark:text-green-400", icon };
    } else if (daysSince <= 3) {
      color = "text-green-600 dark:text-green-400";
    } else if (daysSince <= 7) {
      color = "text-yellow-600 dark:text-yellow-400";
    } else if (daysSince <= 14) {
      color = "text-orange-600 dark:text-orange-400";
    } else {
      color = "text-red-600 dark:text-red-400";
    }

    return {
      text: `${daysSince}d ago`,
      color,
      icon
    };
  };

  const lastContactInfo = getLastContactInfo(lead.lastContactedAt);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-md transition-colors hover-elevate ${
        isSelected 
          ? "bg-primary/10 border border-primary/20" 
          : "hover:bg-muted/50"
      }`}
      data-testid={`button-select-lead-${lead.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{lead.contactName}</span>
            {getPriorityIcon(lead.priority)}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {lead.companyName}
          </p>
          {lastContactInfo && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${lastContactInfo.color}`}>
              <lastContactInfo.icon className="h-3 w-3" />
              <span>{lastContactInfo.text}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {lead.fitScore !== null && lead.fitScore !== undefined && (
            <span className={`text-xs font-mono font-bold ${getFitScoreColor(lead.fitScore)}`}>
              {lead.fitScore}
            </span>
          )}
          {lead.hasResearch && (
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Intel available" />
          )}
        </div>
      </div>
    </button>
  );
}

function LeadDetailPanel({
  lead,
  detail,
  isLoading,
  onResearch,
  onDeepResearch,
  isResearching,
  onCall,
  onHandoff,
  isHandingOff,
  onAiHandoff,
  isAiHandingOff,
}: {
  lead: LeadWithResearch;
  detail: { lead: Lead; researchPacket: ResearchPacket | null } | undefined;
  isLoading: boolean;
  onResearch: () => void;
  onDeepResearch: () => void;
  isResearching: boolean;
  onCall: () => void;
  onHandoff: () => void;
  isHandingOff: boolean;
  onAiHandoff: () => void;
  isAiHandingOff: boolean;
}) {
  const packet = detail?.researchPacket;

  const getPriorityBadge = (priority: string | null) => {
    const styles: Record<string, string> = {
      hot: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      warm: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      cool: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      cold: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
    };
    const icons: Record<string, JSX.Element> = {
      hot: <Flame className="h-3 w-3" />,
      warm: <Zap className="h-3 w-3" />,
      cool: <TrendingUp className="h-3 w-3" />,
      cold: <Snowflake className="h-3 w-3" />,
    };
    if (!priority) return null;
    return (
      <Badge variant="outline" className={`${styles[priority] || ""} gap-1`}>
        {icons[priority]}
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getFitScoreDisplay = (score: number | null) => {
    if (score === null || score === undefined) return null;
    const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
    const bgColor = score >= 70 ? "bg-green-100 dark:bg-green-900/30" : 
                    score >= 40 ? "bg-yellow-100 dark:bg-yellow-900/30" : 
                    "bg-red-100 dark:bg-red-900/30";
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${bgColor}`}>
        <Target className={`h-4 w-4 ${color}`} />
        <span className={`font-mono font-bold text-lg ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold truncate">{lead.contactName}</h2>
              {getPriorityBadge(packet?.priority || lead.priority)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {lead.companyName}
              </span>
              {lead.contactTitle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {lead.contactTitle}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getFitScoreDisplay(packet?.fitScore || lead.fitScore)}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button size="sm" onClick={onCall} data-testid="button-call-lead">
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          {packet && (
            <Button size="sm" variant="outline" asChild>
              <a href={`/call-prep/${lead.id}`} data-testid="button-call-prep">
                <Crosshair className="h-4 w-4 mr-2" />
                Prep
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`mailto:${lead.contactEmail}`} data-testid="button-email-lead">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </a>
          </Button>
          {lead.contactLinkedIn && (
            <Button size="sm" variant="outline" asChild>
              <a href={lead.contactLinkedIn} target="_blank" rel="noopener noreferrer">
                <SiLinkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </a>
            </Button>
          )}
          <div className="flex-1" />
          {lead.status !== "qualified" && lead.status !== "handed_off" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={onAiHandoff}
                disabled={isAiHandingOff}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-ai-handoff"
              >
                {isAiHandingOff ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isAiHandingOff ? "Processing..." : "AI Handoff"}
              </Button>
              {packet && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onHandoff}
                  disabled={isHandingOff}
                  className="border-green-600 text-green-700 hover:bg-green-50"
                  data-testid="button-handoff-to-ae"
                >
                  {isHandingOff ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Manual
                </Button>
              )}
            </div>
          )}
          {(lead.status === "qualified" || lead.status === "handed_off") && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {lead.status === "handed_off" ? "Handed Off" : "Qualified"}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={isResearching}
                data-testid="button-refresh-intel"
              >
                {isResearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onResearch} disabled={isResearching}>
                <Zap className="h-4 w-4 mr-2" />
                Quick Research (~5s)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDeepResearch} disabled={isResearching}>
                <Search className="h-4 w-4 mr-2" />
                Deep Research (~60s)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading && !detail ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : packet ? (
          <IntelDossier packet={packet} lead={lead} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              {isResearching ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              ) : (
                <Crosshair className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-semibold mb-2">
              {isResearching ? "Generating Intel..." : "Intel Pending"}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              {isResearching 
                ? "AI is researching this lead. This typically takes 30-60 seconds."
                : "Research is auto-generated when leads are added. Check back shortly or refresh."}
            </p>
            {!isResearching && (
              <div className="flex gap-2">
                <Button onClick={onResearch} variant="outline" size="sm" data-testid="button-generate-intel">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick (~5s)
                </Button>
                <Button onClick={onDeepResearch} variant="default" size="sm" data-testid="button-deep-research">
                  <Search className="h-4 w-4 mr-2" />
                  Deep (~60s)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PainPointData {
  pain: string;
  severity: string;
  bsaSolution?: string;
}

interface ProductMatchData {
  productId?: string;
  productName: string;
  category?: string;
  matchScore: number;
  rationale: string;
  valueProposition?: string;
}

interface XIntelData {
  xHandle?: string | null;
  profileUrl?: string | null;
  bio?: string | null;
  followerCount?: string | null;
  conversationStarters?: string[];
  industryTrends?: string[];
  hashtags?: string[];
  engagementStyle?: string;
  professionalTone?: string;
  topicsOfInterest?: string[];
  recentPosts?: Array<{ content: string; date?: string }>;
}

interface LinkedInProfileData {
  profileUrl?: string | null;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  connections?: string | null;
  currentPosition?: { title: string; company: string; duration: string } | null;
  careerHistory?: Array<{ title: string; company: string; duration: string }>;
  skills?: string[];
  professionalInterests?: string[];
}

interface CareerHistoryData {
  title: string;
  company: string;
  duration: string;
  relevance?: string;
}

interface ConfidenceAssessmentData {
  overall: "high" | "medium" | "low";
  companyInfoConfidence: "high" | "medium" | "low";
  contactInfoConfidence: "high" | "medium" | "low";
  reasoning: string;
  warnings: string[];
}

interface DossierData {
  companyWebsite?: string;
  companyAddress?: string;
  linkedInUrl?: string;
  phoneNumber?: string;
  jobTitle?: string;
  confidenceAssessment?: ConfidenceAssessmentData;
}

function IntelDossier({ packet, lead }: { packet: ResearchPacket; lead: LeadWithResearch }) {
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingScore, setEditingScore] = useState(false);
  const [scoreValue, setScoreValue] = useState<string>(packet.fitScore?.toString() || "");
  const [priorityValue, setPriorityValue] = useState<string>(packet.priority || "");
  const [speedBriefMode, setSpeedBriefMode] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/leads/${lead.id}/research`);
      if (!res.ok) throw new Error("Failed to delete research");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Dossier Cleared", description: "Research has been deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete research", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string | number | null }) => {
      const res = await apiRequest("PATCH", `/api/leads/${lead.id}/research`, { [field]: value });
      if (!res.ok) throw new Error("Failed to update research");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", lead.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setEditingField(null);
      setEditValue("");
      setEditingScore(false);
      toast({ title: "Updated", description: "Research field updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update research", variant: "destructive" });
    }
  });

  const saveScoring = () => {
    const score = scoreValue ? parseInt(scoreValue) : null;
    if (score !== null && (score < 0 || score > 100)) {
      toast({ title: "Invalid Score", description: "Score must be between 0-100", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ field: "fitScore", value: score });
    if (priorityValue !== packet.priority) {
      updateMutation.mutate({ field: "priority", value: priorityValue || null });
    }
  };

  const startEditing = (field: string, currentValue: string | null) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const saveEdit = () => {
    if (editingField) {
      updateMutation.mutate({ field: editingField, value: editValue });
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const parsePainPointsFromText = (painSignals: string | null): PainPointData[] => {
    if (!painSignals) return [];
    const lines = painSignals.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const severityMatch = line.match(/\[(HIGH|MEDIUM|LOW)\]/i);
      const arrowMatch = line.split('→');
      return {
        pain: arrowMatch[0]?.replace(/\[.*?\]/, '').trim() || line,
        severity: severityMatch?.[1]?.toLowerCase() || 'medium',
        bsaSolution: arrowMatch[1]?.trim() || ''
      };
    }).filter(p => p.pain);
  };

  const parseProductMatchesFromText = (fitAnalysis: string | null): ProductMatchData[] => {
    if (!fitAnalysis) return [];
    const matches: ProductMatchData[] = [];
    const lines = fitAnalysis.split('\n');
    lines.forEach(line => {
      const match = line.match(/^-\s+(.+?)\s+\((\d+)%\):\s*(.*)$/);
      if (match) {
        matches.push({ productName: match[1], matchScore: parseInt(match[2]), rationale: match[3] });
      }
    });
    return matches;
  };

  const parseXProfileFromText = (xIntel: string | null): { handle?: string; bio?: string; style?: string; topics?: string[]; conversationStarters?: string[] } => {
    if (!xIntel) return {};
    const handleMatch = xIntel.match(/Handle:\s*@?(\S+)/);
    const bioMatch = xIntel.match(/Bio:\s*(.+)/);
    const styleMatch = xIntel.match(/Style:\s*(.+)/);
    const topicsMatch = xIntel.match(/Topics:\s*(.+)/);
    
    const conversationStarters: string[] = [];
    const lines = xIntel.split('\n');
    let inStarters = false;
    for (const line of lines) {
      if (line.includes('Conversation Starters:')) {
        inStarters = true;
        continue;
      }
      if (inStarters) {
        const match = line.match(/^\s*\d+\.\s*(.+)$/);
        if (match) conversationStarters.push(match[1]);
        else if (line.trim() && !line.startsWith(' ')) inStarters = false;
      }
    }
    
    return {
      handle: handleMatch?.[1],
      bio: bioMatch?.[1],
      style: styleMatch?.[1],
      topics: topicsMatch?.[1]?.split(',').map(t => t.trim()),
      conversationStarters
    };
  };

  const parseLinkedInFromText = (linkedInIntel: string | null): { headline?: string; location?: string; summary?: string; currentRole?: string } => {
    if (!linkedInIntel) return {};
    const headlineMatch = linkedInIntel.match(/Headline:\s*(.+)/);
    const locationMatch = linkedInIntel.match(/Location:\s*(.+)/);
    const summaryMatch = linkedInIntel.match(/About:\s*(.+)/);
    const currentMatch = linkedInIntel.match(/Current:\s*(.+)/);
    return {
      headline: headlineMatch?.[1],
      location: locationMatch?.[1],
      summary: summaryMatch?.[1],
      currentRole: currentMatch?.[1]
    };
  };

  const painPointsJson = packet.painPointsJson as PainPointData[] | null;
  const productMatchesJson = packet.productMatchesJson as ProductMatchData[] | null;
  const xIntelJson = packet.xIntelJson as XIntelData | null;
  const linkedInProfileJson = packet.linkedInProfileJson as LinkedInProfileData | null;
  const careerHistoryJson = packet.careerHistoryJson as CareerHistoryData[] | null;
  const dossierJson = packet.dossierJson as DossierData | null;
  
  const companyWebsite = dossierJson?.companyWebsite || lead.companyWebsite;
  const confidenceAssessment = dossierJson?.confidenceAssessment;

  const painPoints = (painPointsJson && Array.isArray(painPointsJson) && painPointsJson.length > 0)
    ? painPointsJson
    : parsePainPointsFromText(packet.painSignals);

  const productMatches = (productMatchesJson && Array.isArray(productMatchesJson) && productMatchesJson.length > 0)
    ? productMatchesJson
    : parseProductMatchesFromText(packet.fitAnalysis);

  const xProfile = xIntelJson || parseXProfileFromText(packet.xIntel);
  const conversationStarters = xIntelJson?.conversationStarters || parseXProfileFromText(packet.xIntel).conversationStarters || [];
  const linkedInProfile = linkedInProfileJson || parseLinkedInFromText(packet.linkedInIntel);
  const careerHistory = careerHistoryJson || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'high': return <CheckCircle className="h-3 w-3" />;
      case 'medium': return <AlertCircle className="h-3 w-3" />;
      case 'low': return <AlertTriangle className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {formatDate(packet.updatedAt)}</span>
          <span className="mx-1">|</span>
          <span>{packet.sources}</span>
        </div>
        
        <div className="flex items-center gap-3">
          {editingScore ? (
            <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Score:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreValue}
                  onChange={(e) => setScoreValue(e.target.value)}
                  className="w-16 h-7 px-2 text-sm rounded border bg-background"
                  data-testid="input-fit-score"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Priority:</label>
                <select
                  value={priorityValue}
                  onChange={(e) => setPriorityValue(e.target.value)}
                  className="h-7 px-2 text-sm rounded border bg-background"
                  data-testid="select-priority"
                >
                  <option value="">None</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cool">Cool</option>
                  <option value="cold">Cold</option>
                </select>
              </div>
              <Button size="sm" onClick={saveScoring} disabled={updateMutation.isPending} data-testid="button-save-scoring">
                {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditingScore(false);
                setScoreValue(packet.fitScore?.toString() || "");
                setPriorityValue(packet.priority || "");
              }} data-testid="button-cancel-scoring">
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingScore(true)}
              data-testid="button-edit-scoring"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit Scoring
            </Button>
          )}
        </div>
        
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              data-testid="button-erase-dossier"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Erase Dossier
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase Research Dossier?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all research intel for {lead.companyName}. 
                You can regenerate a new dossier later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Erase"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Speed Brief Toggle */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-medium">Speed Brief</span>
          <span className="text-xs text-muted-foreground">(Opener + Pain + Ask only)</span>
        </div>
        <Button
          size="sm"
          variant={speedBriefMode ? "default" : "outline"}
          onClick={() => setSpeedBriefMode(!speedBriefMode)}
          className="gap-2"
          data-testid="button-speed-brief-toggle"
        >
          {speedBriefMode ? (
            <>
              <FileText className="h-4 w-4" />
              Show Full Dossier
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Speed Brief Mode
            </>
          )}
        </Button>
      </div>

      {/* Speed Brief View */}
      {speedBriefMode ? (
        <div className="space-y-4">
          {/* Opening Line */}
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <span className="font-bold text-lg">Opening Line</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed">
                {packet.talkTrack?.split('\n')[0] || "No opening line available"}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(packet.talkTrack?.split('\n')[0] || "");
                  toast({ title: "Copied!", description: "Opening line copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </CardContent>
          </Card>

          {/* Top Pain Point */}
          <Card className="border-2 border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-bold text-lg">Top Pain Point</span>
              </div>
            </CardHeader>
            <CardContent>
              {painPoints.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-lg font-medium">{painPoints[0].pain}</p>
                  {painPoints[0].bsaSolution && (
                    <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                      <ArrowRight className="h-4 w-4 mt-1 flex-shrink-0" />
                      <span>{painPoints[0].bsaSolution}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No pain points identified</p>
              )}
            </CardContent>
          </Card>

          {/* The Ask */}
          <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="font-bold text-lg">The Ask</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed">
                {packet.talkTrack?.split('\n').find((line: string) => line.toLowerCase().includes("ask") || line.toLowerCase().includes("meeting") || line.toLowerCase().includes("call")) ||
                  "Would you be open to a brief call to discuss how we can help streamline your design and manufacturing processes?"}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2"
                onClick={() => {
                  const theAsk = packet.talkTrack?.split('\n').find((line: string) => line.toLowerCase().includes("ask") || line.toLowerCase().includes("meeting")) || 
                    "Would you be open to a brief call to discuss how we can help streamline your design and manufacturing processes?";
                  navigator.clipboard.writeText(theAsk);
                  toast({ title: "Copied!", description: "Call to action copied to clipboard" });
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <User className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="talk-track" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Talk Track
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Clock className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-6 space-y-6">
          {(companyWebsite || confidenceAssessment) && (
            <div className="flex flex-wrap items-start gap-4 p-4 bg-muted/30 rounded-md border">
              {companyWebsite && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Website:</span>
                  <a 
                    href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    data-testid="link-company-website"
                  >
                    {companyWebsite.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              
              {confidenceAssessment && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">Research Confidence:</span>
                    <Badge 
                      variant="secondary"
                      className={`${getConfidenceColor(confidenceAssessment.overall)} flex items-center gap-1`}
                    >
                      {getConfidenceIcon(confidenceAssessment.overall)}
                      {confidenceAssessment.overall.charAt(0).toUpperCase() + confidenceAssessment.overall.slice(1)}
                    </Badge>
                  </div>
                  
                  {confidenceAssessment.warnings && confidenceAssessment.warnings.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{confidenceAssessment.warnings[0]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <IntelCard 
            icon={Building2}
            title="Company Overview"
            content={packet.companyIntel}
            fieldName="companyIntel"
            isEditing={editingField === "companyIntel"}
            editValue={editValue}
            onStartEdit={() => startEditing("companyIntel", packet.companyIntel)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
          
          <IntelCard 
            icon={TrendingUp}
            title="Hard Intel"
            content={packet.companyHardIntel}
            variant="compact"
            fieldName="companyHardIntel"
            isEditing={editingField === "companyHardIntel"}
            editValue={editValue}
            onStartEdit={() => startEditing("companyHardIntel", packet.companyHardIntel)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
          
          {painPoints.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h4 className="font-medium text-sm">Pain Signals</h4>
              </div>
              <div className="space-y-2">
                {painPoints.map((pp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/30">
                    <Badge variant="outline" className={`shrink-0 text-xs ${getSeverityColor(pp.severity)}`}>
                      {pp.severity.toUpperCase()}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{pp.pain}</p>
                      {pp.bsaSolution && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          {pp.bsaSolution}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {productMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <h4 className="font-medium text-sm">Service Matches</h4>
              </div>
              <div className="grid gap-2">
                {productMatches.map((pm, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
                    <div className={`font-mono font-bold text-lg ${getScoreColor(pm.matchScore)}`}>
                      {pm.matchScore}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{pm.productName}</p>
                      <p className="text-xs text-muted-foreground truncate">{pm.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <IntelCard 
            icon={Globe}
            title="Tech Stack & Competitors"
            content={packet.competitorPresence}
            fieldName="competitorPresence"
            isEditing={editingField === "competitorPresence"}
            editValue={editValue}
            onStartEdit={() => startEditing("competitorPresence", packet.competitorPresence)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="contact" className="mt-6 space-y-6">
          <IntelCard 
            icon={User}
            title="Contact Profile"
            content={packet.contactIntel}
            fieldName="contactIntel"
            isEditing={editingField === "contactIntel"}
            editValue={editValue}
            onStartEdit={() => startEditing("contactIntel", packet.contactIntel)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
          
          {(linkedInProfile.headline || linkedInProfile.currentPosition || 'currentRole' in linkedInProfile) && (
            <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-2 mb-3">
                <SiLinkedin className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-sm">LinkedIn Profile</h4>
              </div>
              {linkedInProfile.headline && (
                <p className="text-sm font-medium mb-1">{linkedInProfile.headline}</p>
              )}
              {linkedInProfile.currentPosition && typeof linkedInProfile.currentPosition === 'object' && (
                <p className="text-sm text-muted-foreground mb-2">
                  {linkedInProfile.currentPosition.title} at {linkedInProfile.currentPosition.company} ({linkedInProfile.currentPosition.duration})
                </p>
              )}
              {'currentRole' in linkedInProfile && linkedInProfile.currentRole && (
                <p className="text-sm text-muted-foreground mb-2">{linkedInProfile.currentRole}</p>
              )}
              {linkedInProfile.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {linkedInProfile.location}
                </p>
              )}
              {linkedInProfile.summary && (
                <p className="text-sm text-foreground/80 mt-3">{linkedInProfile.summary}</p>
              )}
            </div>
          )}
          
          {(('xHandle' in xProfile && xProfile.xHandle) || ('handle' in xProfile && xProfile.handle) || conversationStarters.length > 0) && (
            <div className="p-4 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-3">
                <SiX className="h-4 w-4" />
                <h4 className="font-medium text-sm">X.com Intel</h4>
              </div>
              {(('xHandle' in xProfile && xProfile.xHandle) || ('handle' in xProfile && xProfile.handle)) && (
                <p className="text-sm mb-2">
                  <a 
                    href={`https://x.com/${('xHandle' in xProfile ? xProfile.xHandle : xProfile.handle)?.replace('@', '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    @{('xHandle' in xProfile ? xProfile.xHandle : xProfile.handle)?.replace('@', '')}
                  </a>
                  {(('engagementStyle' in xProfile && xProfile.engagementStyle) || ('style' in xProfile && xProfile.style)) && (
                    <span className="text-muted-foreground ml-2">({'engagementStyle' in xProfile ? xProfile.engagementStyle : xProfile.style})</span>
                  )}
                </p>
              )}
              {xProfile.bio && (
                <p className="text-sm text-foreground/80 mb-3">{xProfile.bio}</p>
              )}
              {(('topicsOfInterest' in xProfile && xProfile.topicsOfInterest && xProfile.topicsOfInterest.length > 0) || ('topics' in xProfile && xProfile.topics && xProfile.topics.length > 0)) && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {('topicsOfInterest' in xProfile ? xProfile.topicsOfInterest : xProfile.topics)?.map((topic, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                  ))}
                </div>
              )}
              {conversationStarters.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Conversation Starters:</p>
                  <ul className="space-y-1.5">
                    {conversationStarters.map((starter, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <MessageSquare className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                        <span className="italic text-foreground/90">{starter}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <IntelCard 
            icon={Target}
            title="Fit Analysis"
            content={packet.fitAnalysis}
            variant="highlight"
            highlightColor="green"
            fieldName="fitAnalysis"
            isEditing={editingField === "fitAnalysis"}
            editValue={editValue}
            onStartEdit={() => startEditing("fitAnalysis", packet.fitAnalysis)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="talk-track" className="mt-6 space-y-6">
          <IntelCard 
            icon={MessageSquare}
            title="Opening & Value Props"
            content={packet.talkTrack}
            variant="highlight"
            highlightColor="blue"
            fieldName="talkTrack"
            isEditing={editingField === "talkTrack"}
            editValue={editValue}
            onStartEdit={() => startEditing("talkTrack", packet.talkTrack)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
          
          <IntelCard 
            icon={HelpCircle}
            title="Discovery Questions"
            content={packet.discoveryQuestions}
            fieldName="discoveryQuestions"
            isEditing={editingField === "discoveryQuestions"}
            editValue={editValue}
            onStartEdit={() => startEditing("discoveryQuestions", packet.discoveryQuestions)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
          
          <IntelCard 
            icon={Shield}
            title="Objection Handles"
            content={packet.objectionHandles}
            fieldName="objectionHandles"
            isEditing={editingField === "objectionHandles"}
            editValue={editValue}
            onStartEdit={() => startEditing("objectionHandles", packet.objectionHandles)}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onEditValueChange={setEditValue}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ActivityTabContent leadId={lead.id} />
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}

function ActivityTabContent({ leadId }: { leadId: string }) {
  const { data: callHistory = [], isLoading } = useQuery<CallSession[]>({
    queryKey: ["/api/leads", leadId, "calls"],
  });

  return (
    <LeadActivityTimeline
      callHistory={callHistory}
      isLoading={isLoading}
      onPlayRecording={(url) => window.open(url, "_blank")}
    />
  );
}

function IntelCard({ 
  icon: Icon, 
  title, 
  content,
  variant = "default",
  highlightColor,
  fieldName,
  isEditing,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  isSaving
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  content: string | null;
  variant?: "default" | "compact" | "highlight";
  highlightColor?: "red" | "green" | "blue" | "yellow";
  fieldName?: string;
  isEditing?: boolean;
  editValue?: string;
  onStartEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onEditValueChange?: (value: string) => void;
  isSaving?: boolean;
}) {
  if (!content && !isEditing) return null;

  const highlightStyles: Record<string, string> = {
    red: "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
    green: "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20",
    blue: "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    yellow: "border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20",
  };

  const baseStyles = variant === "highlight" && highlightColor 
    ? highlightStyles[highlightColor] 
    : "bg-muted/30";

  const formatContent = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let listItems: JSX.Element[] = [];
    let listKey = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${listKey++}`} className="space-y-1 ml-4">
            {listItems}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }
      
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed)) {
        const cleanText = trimmed.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
        listItems.push(
          <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
            <ChevronRight className="h-3 w-3 mt-1.5 text-muted-foreground shrink-0" />
            <span>{cleanText}</span>
          </li>
        );
        return;
      }
      
      flushList();
      
      if (trimmed.endsWith(':') && trimmed.length < 60) {
        elements.push(
          <p key={i} className="font-medium text-sm mt-3 mb-1 text-foreground">
            {trimmed}
          </p>
        );
        return;
      }
      
      elements.push(
        <p key={i} className="text-sm text-foreground/90 mb-2">
          {trimmed}
        </p>
      );
    });

    flushList();
    return elements;
  };
  
  return (
    <div className={`p-4 rounded-lg ${baseStyles}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">{title}</h4>
        </div>
        {fieldName && !isEditing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onStartEdit}
            data-testid={`button-edit-${fieldName}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-green-600"
              onClick={onSave}
              disabled={isSaving}
              data-testid={`button-save-${fieldName}`}
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground"
              onClick={onCancel}
              disabled={isSaving}
              data-testid={`button-cancel-${fieldName}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {isEditing ? (
        <Textarea
          value={editValue}
          onChange={(e) => onEditValueChange?.(e.target.value)}
          className="min-h-[150px] text-sm"
          data-testid={`textarea-edit-${fieldName}`}
        />
      ) : (
        <div className={variant === "compact" ? "text-sm" : ""}>
          {content && formatContent(content)}
        </div>
      )}
    </div>
  );
}

function ImportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ imported: number; skipped: number; duplicates: number } | null>(null);
  const { toast } = useToast();

  const handleImport = async () => {
    setImporting(true);
    setResults(null);
    
    try {
      const res = await apiRequest("POST", "/api/leads/import");
      const data = await res.json();
      setResults({
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        duplicates: data.duplicates || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Import Complete", description: `${data.imported} leads imported` });
    } catch (error) {
      toast({ title: "Import Failed", description: "Could not import leads", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Import leads from the connected Google Sheet
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {results ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Badge variant="default">{results.imported}</Badge>
                leads imported successfully
              </p>
              {results.skipped > 0 && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">{results.skipped}</Badge>
                  rows skipped (missing required fields)
                </p>
              )}
              {results.duplicates > 0 && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline">{results.duplicates}</Badge>
                  duplicates detected
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This will import all leads from your configured Google Sheet. Duplicate emails will be skipped.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddLeadModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    contactName: "",
    contactEmail: "",
    companyName: "",
    contactTitle: "",
    contactPhone: "",
    companyWebsite: "",
    contactLinkedIn: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contactName.trim() || !formData.contactEmail.trim() || !formData.companyName.trim()) {
      toast({ title: "Missing Required Fields", description: "Name, email, and company are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiRequest("POST", "/api/leads", {
        contactName: formData.contactName.trim(),
        contactEmail: formData.contactEmail.trim(),
        companyName: formData.companyName.trim(),
        contactTitle: formData.contactTitle.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        companyWebsite: formData.companyWebsite.trim() || null,
        contactLinkedIn: formData.contactLinkedIn.trim() || null,
        source: "manual",
        status: "new",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead Added", description: `${formData.contactName} has been added to the database` });
      setFormData({
        contactName: "",
        contactEmail: "",
        companyName: "",
        contactTitle: "",
        contactPhone: "",
        companyWebsite: "",
        contactLinkedIn: "",
      });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Failed to Add Lead", description: "Could not save the lead", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Manually enter lead information
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Name *</Label>
            <Input
              id="contactName"
              placeholder="John Smith"
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              data-testid="input-lead-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email *</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="john@company.com"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              data-testid="input-lead-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company *</Label>
            <Input
              id="companyName"
              placeholder="Acme Corporation"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              data-testid="input-lead-company"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactTitle">Job Title</Label>
            <Input
              id="contactTitle"
              placeholder="Engineering Manager"
              value={formData.contactTitle}
              onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })}
              data-testid="input-lead-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              data-testid="input-lead-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyWebsite">Company Website</Label>
            <Input
              id="companyWebsite"
              type="url"
              placeholder="https://company.com"
              value={formData.companyWebsite}
              onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
              data-testid="input-lead-website"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactLinkedIn">LinkedIn Profile</Label>
            <Input
              id="contactLinkedIn"
              placeholder="https://linkedin.com/in/johndoe"
              value={formData.contactLinkedIn}
              onChange={(e) => setFormData({ ...formData, contactLinkedIn: e.target.value })}
              data-testid="input-lead-linkedin"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="button-save-lead">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
