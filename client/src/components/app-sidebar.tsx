import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Phone,
  FileSearch,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Target,
  Calculator,
  Activity,
  TrendingUp
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import type { NavigationSetting } from "@shared/schema";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["admin", "manager", "sdr", "account_specialist"],
  },
  {
    title: "Leads",
    url: "/leads",
    icon: FileSearch,
    allowedRoles: ["admin", "manager", "sdr", "account_specialist"],
  },
  {
    title: "Call Center",
    url: "/coaching",
    icon: Phone,
    allowedRoles: ["admin", "manager", "sdr", "account_specialist"],
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
    allowedRoles: ["admin", "manager"],
  },
  {
    title: "Manager Dashboard",
    url: "/manager-dashboard",
    icon: Activity,
    allowedRoles: ["admin", "manager"],
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    allowedRoles: ["admin", "manager"],
  },
  {
    title: "AE Pipeline",
    url: "/ae-pipeline",
    icon: Target,
    allowedRoles: ["admin", "manager", "account_executive"],
  },
  {
    title: "Budgeting",
    url: "/budgeting",
    icon: Calculator,
    allowedRoles: ["admin", "manager", "sdr", "account_specialist", "account_executive"],
  },
];

const settingsNavItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const { data: navigationSettings = [] } = useQuery<NavigationSetting[]>({
    queryKey: ["/api/navigation-settings"],
    enabled: !!user,
  });

  const navKeyMap: Record<string, string> = {
    dashboard: "Dashboard",
    leads: "Leads",
    call_center: "Call Center",
    team: "Team",
    reports: "Reports",
    ae_pipeline: "AE Pipeline",
    budgeting: "Budgeting",
  };

  const filteredAndSortedNavItems = mainNavItems
    .filter((item) => {
      if (!user || !item.allowedRoles.includes(user.role)) return false;
      if (navigationSettings.length === 0) return true;
      const navKey = Object.entries(navKeyMap).find(([, title]) => title === item.title)?.[0];
      if (!navKey) return true;
      const setting = navigationSettings.find((s) => s.navKey === navKey);
      return setting ? setting.isEnabled : true;
    })
    .sort((a, b) => {
      if (navigationSettings.length === 0) return 0;
      const navKeyA = Object.entries(navKeyMap).find(([, title]) => title === a.title)?.[0];
      const navKeyB = Object.entries(navKeyMap).find(([, title]) => title === b.title)?.[0];
      const settingA = navigationSettings.find((s) => s.navKey === navKeyA);
      const settingB = navigationSettings.find((s) => s.navKey === navKeyB);
      return (settingA?.sortOrder ?? 99) - (settingB?.sortOrder ?? 99);
    });

  // Dynamic "My Performance" item for users with SDR profile
  const myPerformanceItem = user?.sdrId ? {
    title: "My Performance",
    url: `/team/${user.sdrId}`,
    icon: TrendingUp,
  } : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    const roleLabels: Record<string, string> = {
      admin: "Admin",
      manager: "Manager",
      sdr: "SDR",
      account_specialist: "Specialist",
      account_executive: "AE",
    };
    return roleLabels[role] || role;
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-[#EF4444]" />
              <div className="w-3 h-3 rounded-sm bg-[#EAB308]" />
              <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
            </div>
            <span className="font-bold text-base tracking-tight">GameTime.ai</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 pl-0.5">Lead Intel</p>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredAndSortedNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || location.startsWith(item.url + "/")}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {myPerformanceItem && (
                <SidebarMenuItem key={myPerformanceItem.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === myPerformanceItem.url}
                  >
                    <Link href={myPerformanceItem.url} data-testid="nav-my-performance">
                      <myPerformanceItem.icon className="h-4 w-4" />
                      <span>{myPerformanceItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 h-auto py-2 px-2"
                data-testid="button-user-menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium truncate w-full text-left">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{getRoleBadge(user.role)}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
