/**
 * AM Research Workspace
 * Account Manager view: coverage status, whitespace analysis, contact discovery,
 * and Salesforce history for all accounts in the pipeline.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  MapPin,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Building2,
  UserSearch,
  Database,
  TrendingUp,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AccountSummary {
  companyName: string;
  companyWebsite: string | null;
  companyIndustry: string | null;
  leadCount: number;
  avgFitScore: number | null;
  lastActivityDate: string | null;
  hasActiveSdr: boolean;
  coverageStatus: "active" | "stale" | "dark";
  whitespaceScore: number;
  topLead: {
    id: string;
    contactName: string;
    contactTitle: string | null;
    fitScore: number | null;
    status: string;
  } | null;
  leadIds: string[];
}

interface ProspectContact {
  companyName: string;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedIn: string | null;
  fitScore: number;
  priority: string;
  qualifies: boolean;
  reasoning: string;
}

interface DiscoverResult {
  companyName: string;
  discovered: number;
  added: number;
  contacts: ProspectContact[];
  durationMs: number;
}

interface SFHistory {
  connected: boolean;
  message?: string;
  company?: string;
  accounts?: SFAccount[];
  opportunities?: SFOpportunity[];
  activities?: SFActivity[];
}

interface SFAccount {
  Id: string;
  Name: string;
  Industry: string | null;
  AnnualRevenue: number | null;
  NumberOfEmployees: number | null;
  BillingCity: string | null;
  BillingState: string | null;
}

interface SFOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
  IsClosed: boolean;
  IsWon: boolean;
  AccountId: string;
}

interface SFActivity {
  Id: string;
  Subject: string;
  ActivityDate: string | null;
  Status: string | null;
  Description: string | null;
}

// ─── Coverage badge ─────────────────────────────────────────────────────────────

const COVERAGE_CONFIG = {
  active: {
    label: "Active",
    className: "bg-green-500 text-white",
    Icon: CheckCircle2,
  },
  stale: {
    label: "Stale",
    className: "bg-amber-500 text-white",
    Icon: AlertTriangle,
  },
  dark: {
    label: "Dark",
    className: "bg-red-500 text-white",
    Icon: XCircle,
  },
} as const;

function CoverageBadge({ status }: { status: AccountSummary["coverageStatus"] }) {
  const config = COVERAGE_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        config.className
      )}
    >
      <config.Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ─── Account card ───────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onDiscover,
  onSfHistory,
}: {
  account: AccountSummary;
  onDiscover: (account: AccountSummary) => void;
  onSfHistory: (account: AccountSummary) => void;
}) {
  const isPlaceholder = account.topLead?.contactName?.startsWith("Contact at ");

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base truncate">{account.companyName}</h3>
            <CoverageBadge status={account.coverageStatus} />
          </div>
          {account.companyIndustry && (
            <p className="text-xs text-muted-foreground mt-0.5">{account.companyIndustry}</p>
          )}
        </div>
        {account.avgFitScore != null && (
          <div className="shrink-0 flex flex-col items-center">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                account.avgFitScore >= 80
                  ? "text-green-500"
                  : account.avgFitScore >= 60
                  ? "text-amber-500"
                  : "text-red-500"
              )}
            >
              {account.avgFitScore}
            </span>
            <span className="text-[10px] text-muted-foreground">Fit</span>
          </div>
        )}
      </div>

      {/* Whitespace */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium">Whitespace Opportunity</span>
          <span className="text-xs font-semibold">{account.whitespaceScore}%</span>
        </div>
        <Progress
          value={account.whitespaceScore}
          className={cn(
            "h-1.5",
            account.whitespaceScore >= 70
              ? "[&>div]:bg-green-500"
              : account.whitespaceScore >= 40
              ? "[&>div]:bg-amber-500"
              : "[&>div]:bg-red-400"
          )}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {account.leadCount} contact{account.leadCount !== 1 ? "s" : ""}
        </span>
        {account.hasActiveSdr && (
          <span className="flex items-center gap-1 text-blue-500">
            <Activity className="h-3 w-3" />
            SDR assigned
          </span>
        )}
        {account.lastActivityDate ? (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {formatDistanceToNow(new Date(account.lastActivityDate), { addSuffix: true })}
          </span>
        ) : (
          <span className="text-muted-foreground/60 italic">No activity recorded</span>
        )}
      </div>

      {/* Top lead */}
      {account.topLead && (
        <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs">
          <span className="text-muted-foreground">Top contact: </span>
          {isPlaceholder ? (
            <span className="italic text-muted-foreground">Unknown — discover contacts</span>
          ) : (
            <>
              <span className="font-medium">{account.topLead.contactName}</span>
              {account.topLead.contactTitle && (
                <span className="text-muted-foreground"> · {account.topLead.contactTitle}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => onDiscover(account)}
        >
          <UserSearch className="h-3.5 w-3.5" />
          Discover Contacts
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 text-xs"
          onClick={() => onSfHistory(account)}
        >
          <Database className="h-3.5 w-3.5" />
          SF History
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function AMWorkspacePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "stale" | "dark">("all");

  // Discover contacts sheet state
  const [discoverSheet, setDiscoverSheet] = useState<{
    open: boolean;
    account: AccountSummary | null;
    result: DiscoverResult | null;
  }>({ open: false, account: null, result: null });

  // Salesforce history dialog state
  const [sfDialog, setSfDialog] = useState<{
    open: boolean;
    account: AccountSummary | null;
  }>({ open: false, account: null });
  const [sfCompany, setSfCompany] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery<{ accounts: AccountSummary[]; total: number }>({
    queryKey: ["/api/am/accounts"],
    queryFn: () =>
      fetch("/api/am/accounts", { credentials: "include" }).then((r) => r.json()),
  });

  const { data: sfData, isLoading: sfLoading } = useQuery<SFHistory>({
    queryKey: ["/api/am/accounts/salesforce-history", sfCompany],
    queryFn: () =>
      fetch(`/api/am/accounts/salesforce-history?company=${encodeURIComponent(sfCompany!)}`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: !!sfCompany,
  });

  const discoverMutation = useMutation({
    mutationFn: async (account: AccountSummary) => {
      const res = await fetch("/api/am/accounts/discover-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName: account.companyName,
          companyWebsite: account.companyWebsite,
          existingLeadIds: account.leadIds,
        }),
      });
      if (!res.ok) throw new Error("Discovery failed");
      return res.json() as Promise<DiscoverResult>;
    },
    onSuccess: (result) => {
      setDiscoverSheet((s) => ({ ...s, result }));
      toast({
        title: `Found ${result.discovered} contacts`,
        description: `${result.added} new contacts added to pipeline`,
      });
    },
    onError: () => {
      toast({ title: "Discovery failed", variant: "destructive" });
    },
  });

  // ── Filtered accounts ────────────────────────────────────────────────────────

  const accounts = useMemo(() => {
    if (!data?.accounts) return [];
    return data.accounts.filter((a) => {
      const matchesSearch =
        !search ||
        a.companyName.toLowerCase().includes(search.toLowerCase()) ||
        (a.companyIndustry ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || a.coverageStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data?.accounts, search, statusFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all = data?.accounts ?? [];
    return {
      total: all.length,
      active: all.filter((a) => a.coverageStatus === "active").length,
      stale: all.filter((a) => a.coverageStatus === "stale").length,
      dark: all.filter((a) => a.coverageStatus === "dark").length,
    };
  }, [data?.accounts]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDiscover = (account: AccountSummary) => {
    setDiscoverSheet({ open: true, account, result: null });
    discoverMutation.mutate(account);
  };

  const handleSfHistory = (account: AccountSummary) => {
    setSfDialog({ open: true, account });
    setSfCompany(account.companyName);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">AM Research Workspace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Account coverage map · whitespace analysis · contact discovery
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts", value: stats.total, icon: Building2, color: "text-foreground" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-green-500" },
          { label: "Stale (>30d)", value: stats.stale, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Dark (no contact)", value: stats.dark, icon: XCircle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="dark">Dark only</SelectItem>
            <SelectItem value="stale">Stale only</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Account grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No accounts found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.companyName}
              account={account}
              onDiscover={handleDiscover}
              onSfHistory={handleSfHistory}
            />
          ))}
        </div>
      )}

      {/* ── Discover Contacts Sheet ─────────────────────────────────────────── */}
      <Sheet
        open={discoverSheet.open}
        onOpenChange={(open) => setDiscoverSheet((s) => ({ ...s, open }))}
      >
        <SheetContent className="w-[420px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserSearch className="h-5 w-5 text-primary" />
              Contact Discovery
            </SheetTitle>
            <SheetDescription>
              Finding additional contacts at{" "}
              <strong>{discoverSheet.account?.companyName}</strong>
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {discoverMutation.isPending && (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Scanning LinkedIn and web sources…</p>
              </div>
            )}

            {discoverMutation.isError && (
              <div className="text-center py-8 text-destructive text-sm">
                Discovery failed. Please try again.
              </div>
            )}

            {discoverSheet.result && !discoverMutation.isPending && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
                  <span>
                    Found <strong className="text-foreground">{discoverSheet.result.discovered}</strong> contacts
                  </span>
                  <span>{(discoverSheet.result.durationMs / 1000).toFixed(1)}s</span>
                </div>

                {discoverSheet.result.contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No new contacts discovered. The company may already be fully covered.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {discoverSheet.result.contacts.map((contact, i) => (
                      <div
                        key={i}
                        className="border border-border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">
                              {contact.contactName ?? "Unknown"}
                            </p>
                            {contact.contactTitle && (
                              <p className="text-xs text-muted-foreground">
                                {contact.contactTitle}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded",
                              contact.fitScore >= 70
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : contact.fitScore >= 50
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {contact.fitScore}
                          </span>
                        </div>
                        {contact.contactEmail && (
                          <p className="text-xs text-muted-foreground">{contact.contactEmail}</p>
                        )}
                        {contact.reasoning && (
                          <p className="text-xs text-muted-foreground/80 italic line-clamp-2">
                            {contact.reasoning}
                          </p>
                        )}
                        {contact.contactLinkedIn && (
                          <a
                            href={contact.contactLinkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                          >
                            LinkedIn <ChevronRight className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Salesforce History Dialog ───────────────────────────────────────── */}
      <Dialog
        open={sfDialog.open}
        onOpenChange={(open) => {
          setSfDialog((s) => ({ ...s, open }));
          if (!open) setSfCompany(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Salesforce History — {sfDialog.account?.companyName}
            </DialogTitle>
          </DialogHeader>

          {sfLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          )}

          {!sfLoading && sfData && !sfData.connected && (
            <div className="text-center py-8 space-y-2">
              <Database className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">{sfData.message}</p>
              <a href="/settings" className="text-primary text-sm hover:underline">
                Go to Settings to connect Salesforce
              </a>
            </div>
          )}

          {!sfLoading && sfData?.connected && (
            <Tabs defaultValue="opportunities">
              <TabsList className="w-full">
                <TabsTrigger value="opportunities" className="flex-1">
                  Opportunities ({sfData.opportunities?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="accounts" className="flex-1">
                  Accounts ({sfData.accounts?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex-1">
                  Activities ({sfData.activities?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              {/* Opportunities */}
              <TabsContent value="opportunities" className="mt-4">
                {!sfData.opportunities?.length ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No opportunities found in Salesforce
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sfData.opportunities.map((opp) => (
                      <div
                        key={opp.Id}
                        className="flex items-center justify-between border border-border rounded-lg px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">{opp.Name}</p>
                          <p className="text-xs text-muted-foreground">{opp.StageName}</p>
                        </div>
                        <div className="text-right">
                          {opp.Amount != null && (
                            <p className="font-semibold">
                              ${opp.Amount.toLocaleString()}
                            </p>
                          )}
                          <Badge
                            variant={opp.IsWon ? "default" : opp.IsClosed ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {opp.IsWon ? "Won" : opp.IsClosed ? "Closed" : "Open"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Accounts */}
              <TabsContent value="accounts" className="mt-4">
                {!sfData.accounts?.length ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No matching accounts in Salesforce
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sfData.accounts.map((acc) => (
                      <div
                        key={acc.Id}
                        className="border border-border rounded-lg px-4 py-3 text-sm space-y-1"
                      >
                        <p className="font-medium">{acc.Name}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                          {acc.Industry && <span>{acc.Industry}</span>}
                          {acc.NumberOfEmployees && (
                            <span>{acc.NumberOfEmployees.toLocaleString()} employees</span>
                          )}
                          {acc.AnnualRevenue != null && (
                            <span>${(acc.AnnualRevenue / 1e6).toFixed(1)}M revenue</span>
                          )}
                          {(acc.BillingCity || acc.BillingState) && (
                            <span>
                              {[acc.BillingCity, acc.BillingState].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Activities */}
              <TabsContent value="activities" className="mt-4">
                {!sfData.activities?.length ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No recent activities found in Salesforce
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sfData.activities.map((task) => (
                      <div
                        key={task.Id}
                        className="border border-border rounded-lg px-4 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{task.Subject}</p>
                          {task.Status && (
                            <Badge variant="outline" className="text-[10px]">
                              {task.Status}
                            </Badge>
                          )}
                        </div>
                        {task.ActivityDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(task.ActivityDate).toLocaleDateString()}
                          </p>
                        )}
                        {task.Description && (
                          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                            {task.Description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
