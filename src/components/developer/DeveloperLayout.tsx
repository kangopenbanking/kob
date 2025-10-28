import { ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code, Home, Layers, Zap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navSections = [
  {
    title: "Getting Started",
    icon: Home,
    items: [
      { title: "Integration Workflow", path: "/integration-workflow" },
      { title: "Quick Start", path: "/developer/getting-started" },
      { title: "Authentication", path: "/developer/getting-started/authentication" },
      { title: "First API Call", path: "/developer/getting-started/first-call" },
    ],
  },
  {
    title: "API Reference",
    icon: Code,
    items: [
      { title: "AISP APIs", path: "/developer/api/aisp" },
      { title: "PISP APIs", path: "/developer/api/pisp" },
      { title: "Mobile Money", path: "/developer/api/mobile-money" },
      { title: "Banking Operations", path: "/developer/api/banking" },
      { title: "Webhooks", path: "/developer/api/webhooks" },
    ],
  },
  {
    title: "Integration Guides",
    icon: Layers,
    items: [
      { title: "Web Applications", path: "/developer/guides/web" },
      { title: "Mobile Apps", path: "/developer/guides/mobile" },
      { title: "SDKs & Libraries", path: "/developer/guides/sdks" },
    ],
  },
  {
    title: "Resources",
    icon: Zap,
    items: [
      { title: "API Console", path: "/developer/console" },
      { title: "Code Examples", path: "/developer/examples" },
      { title: "Sandbox", path: "/developer/sandbox" },
    ],
  },
];

interface DeveloperLayoutProps {
  children?: ReactNode;
}

export function DeveloperLayout({ children }: DeveloperLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r">
          <div className="p-4 border-b">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full justify-start"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>

          <SidebarContent>
            {navSections.map((section) => (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="flex items-center gap-2">
                  <section.icon className="h-4 w-4" />
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActivePath(item.path)}>
                          <Link to={item.path}>
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
            <Link to="/developer" className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              <span className="font-semibold">Developer Portal</span>
            </Link>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
          </header>

          <main className="flex-1 p-6">
            {children || <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
