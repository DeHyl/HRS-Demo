import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Map, Mail, Plus, Trash2, Save } from "lucide-react";

interface RobinConfig {
  id: string;
  escalationScoreThreshold: number;
  escalateOnBudget: boolean;
  escalateOnDeadline: boolean;
  escalateOnDemo: boolean;
  autoReplyOnEscalation: boolean;
  escalationNote: string;
  handoffTemplate: string | null;
  fallbackAeId: string | null;
}

interface TerritoryRoute {
  id: string;
  region: string;
  aeId: string | null;
  isActive: boolean;
  priority: number;
}

interface AE {
  id: string;
  name: string;
  email: string;
  region: string | null;
  specialty: string | null;
  isActive: boolean;
}

const HANDOFF_TEMPLATE_VARS = [
  "{{contactName}}", "{{companyName}}", "{{contactEmail}}", "{{date}}",
  "{{subject}}", "{{engagementScore}}", "{{budget}}", "{{authority}}",
  "{{need}}", "{{timeline}}", "{{products}}", "{{questions}}",
  "{{urgencySignals}}", "{{summary}}", "{{nextStep}}", "{{threadHistory}}"
];

export default function RobinSettingsPage() {
  const { toast } = useToast();

  const { data: config, isLoading: configLoading } = useQuery<RobinConfig>({
    queryKey: ["robin-config"],
    queryFn: () => fetch("/api/robin/config", { credentials: "include" }).then(r => r.json()),
  });

  const { data: routes = [], isLoading: routesLoading } = useQuery<TerritoryRoute[]>({
    queryKey: ["robin-routing"],
    queryFn: () => fetch("/api/robin/routing", { credentials: "include" }).then(r => r.json()),
  });

  const { data: aes = [] } = useQuery<AE[]>({
    queryKey: ["account-executives"],
    queryFn: () => fetch("/api/ae", { credentials: "include" }).then(r => r.json()),
  });

  const [localConfig, setLocalConfig] = useState<Partial<RobinConfig>>({});
  const [newRegion, setNewRegion] = useState("");
  const [newAeId, setNewAeId] = useState("");

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const saveConfigMutation = useMutation({
    mutationFn: () => fetch("/api/robin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(localConfig),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robin-config"] });
      toast({ title: "Robin config saved" });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const addRouteMutation = useMutation({
    mutationFn: () => fetch("/api/robin/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ region: newRegion, aeId: newAeId || null, isActive: true, priority: routes.length }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robin-routing"] });
      setNewRegion("");
      setNewAeId("");
      toast({ title: "Territory added" });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<TerritoryRoute> & { id: string }) =>
      fetch(`/api/robin/routing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["robin-routing"] }),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/robin/routing/${id}`, {
      method: "DELETE", credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robin-routing"] });
      toast({ title: "Territory removed" });
    },
  });

  const cfg = localConfig;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Robin Settings</h1>
          <p className="text-sm text-muted-foreground">Configure the AI inbound agent behavior, escalation rules, and AE routing</p>
        </div>
      </div>

      {/* Section 1: Escalation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" /> Escalation Rules
          </CardTitle>
          <CardDescription>Define when Robin hands off a conversation to a human AE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Escalate when engagement score ≥</Label>
                <p className="text-xs text-muted-foreground">1 = cold, 5 = ready to buy</p>
              </div>
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map(n => (
                  <button
                    key={n}
                    onClick={() => setLocalConfig(c => ({ ...c, escalationScoreThreshold: n }))}
                    className={`w-8 h-8 rounded text-sm font-medium border transition-colors ${cfg.escalationScoreThreshold === n ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                  >{n}</button>
                ))}
              </div>
            </div>

            {[
              { key: "escalateOnBudget", label: "Escalate when budget is mentioned" },
              { key: "escalateOnDeadline", label: "Escalate when a deadline is mentioned" },
              { key: "escalateOnDemo", label: "Escalate when a demo or quote is requested" },
              { key: "autoReplyOnEscalation", label: "Auto-reply even when escalating (Robin responds + notifies AE)" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <Label className="text-sm">{label}</Label>
                <Switch
                  checked={!!(cfg as any)[key]}
                  onCheckedChange={v => setLocalConfig(c => ({ ...c, [key]: v }))}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Escalation note added to prospect email</Label>
              <Textarea
                value={cfg.escalationNote || ""}
                onChange={e => setLocalConfig(c => ({ ...c, escalationNote: e.target.value }))}
                rows={2}
                className="text-sm"
                placeholder="Note appended to Robin's reply when escalating..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Fallback AE (if no territory match)</Label>
              <Select
                value={cfg.fallbackAeId || "none"}
                onValueChange={v => setLocalConfig(c => ({ ...c, fallbackAeId: v === "none" ? null : v }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select fallback AE..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {aes.map(ae => (
                    <SelectItem key={ae.id} value={ae.id}>{ae.name} ({ae.region || "no region"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveConfigMutation.isPending ? "Saving..." : "Save Escalation Rules"}
          </Button>
        </CardContent>
      </Card>

      {/* Section 2: AE Territory Routing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="w-4 h-4" /> AE Territory Routing
          </CardTitle>
          <CardDescription>Map regions to Account Executives. Robin uses this to route handoff emails automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {routesLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {routes.map(route => {
                const ae = aes.find(a => a.id === route.aeId);
                return (
                  <div key={route.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <Switch
                      checked={route.isActive}
                      onCheckedChange={v => updateRouteMutation.mutate({ id: route.id, isActive: v })}
                    />
                    <Input
                      defaultValue={route.region}
                      className="text-sm h-8 w-32"
                      onBlur={e => updateRouteMutation.mutate({ id: route.id, region: e.target.value })}
                    />
                    <Select
                      value={route.aeId || "none"}
                      onValueChange={v => updateRouteMutation.mutate({ id: route.id, aeId: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="text-sm h-8 flex-1">
                        <SelectValue placeholder="Assign AE..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {aes.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name} — {a.specialty || a.region || "General"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {ae && <Badge variant="outline" className="text-xs whitespace-nowrap">{ae.email}</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={() => deleteRouteMutation.mutate(route.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}

              {routes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No territory rules yet. Add one below.</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              placeholder="Region (e.g. West, Canada - BC)"
              value={newRegion}
              onChange={e => setNewRegion(e.target.value)}
              className="text-sm h-8"
            />
            <Select value={newAeId} onValueChange={setNewAeId}>
              <SelectTrigger className="text-sm h-8 flex-1">
                <SelectValue placeholder="Assign AE..." />
              </SelectTrigger>
              <SelectContent>
                {aes.map(ae => (
                  <SelectItem key={ae.id} value={ae.id}>{ae.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={() => addRouteMutation.mutate()} disabled={!newRegion || addRouteMutation.isPending}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Handoff Email Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> Handoff Email Template
          </CardTitle>
          <CardDescription>Customize the email Robin sends to the AE when handing off a lead. Uses Markdown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <p className="text-xs text-muted-foreground w-full mb-1">Available variables:</p>
            {HANDOFF_TEMPLATE_VARS.map(v => (
              <button
                key={v}
                onClick={() => setLocalConfig(c => ({ ...c, handoffTemplate: (c.handoffTemplate || "") + v }))}
                className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted font-mono"
              >{v}</button>
            ))}
          </div>
          <Textarea
            value={cfg.handoffTemplate || ""}
            onChange={e => setLocalConfig(c => ({ ...c, handoffTemplate: e.target.value }))}
            rows={16}
            className="font-mono text-xs resize-none"
            placeholder="Leave blank to use the default template..."
          />
          <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveConfigMutation.isPending ? "Saving..." : "Save Template"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
