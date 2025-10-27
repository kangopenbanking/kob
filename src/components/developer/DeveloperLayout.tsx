import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Search, Menu, X, ChevronDown, ChevronRight, Book, Code, Smartphone, Layers, Zap, Shield, Webhook, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

export function DeveloperLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link to="/developer" className="flex items-center gap-2">
              <Code className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl">KOB Developers</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Link to="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 h-[calc(100vh-4rem)] w-64 border-r bg-background transition-transform lg:translate-x-0 z-40 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <ScrollArea className="h-full py-6 px-4">
            <nav className="space-y-2">
              {navSections.map((section) => (
                <Collapsible key={section.title} defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
                    <div className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      {section.title}
                    </div>
                    <ChevronDown className="h-4 w-4 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1 pl-6">
                    {section.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                          isActivePath(item.path)
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent"
                        }`}
                      >
                        {item.title}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="container max-w-5xl py-8 px-4 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
