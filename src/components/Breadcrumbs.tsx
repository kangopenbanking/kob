import { Link, useLocation } from "react-router-dom";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeNames: Record<string, string> = {
  admin: "Admin Portal",
  dashboard: "Dashboard",
  users: "User Management",
  "api-clients": "API Clients",
  sandbox: "Sandbox Management",
  security: "Security Monitoring",
  "audit-logs": "Audit Logs",
  "system-config": "System Configuration",
  webhooks: "Webhook Management",
  branches: "Branch Management",
  transactions: "Transaction Monitoring",
  "consent-data": "Consent Data",
  health: "Health Monitoring",
  "rls-monitoring": "RLS Monitoring",
  "api-health": "API Health",
  "api-testing": "API Testing",
  "system-alerts": "System Alerts",
  "api-performance": "API Performance",
  "rate-limits": "Rate Limits",
  "api-docs": "API Documentation",
  "load-testing": "Load Testing",
  "audit-trail": "Audit Trail",
  "anomaly-detection": "Anomaly Detection",
  "credit-management": "Credit Management",
  "payment-facilitation": "Payment Facilitation",
  "system-monitoring": "System Monitoring",
  "fee-management": "Fee Management",
  communications: "Communications",
  "compliance-dashboard": "Compliance",
  "credit-score": "Credit Score",
  "credit-report": "Credit Report",
  crediq: "CrediQ",
  "mobile-money": "Mobile Money",
  payments: "Payments",
  savings: "Savings",
  loans: "Loans",
  "virtual-cards": "Virtual Cards",
  "banking-ops": "Banking Operations",
  profile: "Profile Settings",
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {pathnames.map((segment, index) => {
          const path = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <React.Fragment key={path}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={path}>{name}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

import React from "react";
