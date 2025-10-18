import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Users, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield
} from "lucide-react";

const Admin = () => {
  // Mock data
  const stats = [
    {
      title: "Total Institutions",
      value: "48",
      change: "+5 this month",
      icon: Building2,
      color: "text-primary"
    },
    {
      title: "API Requests Today",
      value: "12,543",
      change: "+15% from yesterday",
      icon: Activity,
      color: "text-accent"
    },
    {
      title: "Transaction Volume",
      value: "125M XAF",
      change: "+22% this week",
      icon: DollarSign,
      color: "text-primary"
    },
    {
      title: "Active Connections",
      value: "156",
      change: "98% uptime",
      icon: TrendingUp,
      color: "text-accent"
    }
  ];

  const pendingApplications = [
    { name: "Douala Credit Union", type: "Credit Union", date: "2025-01-15", status: "pending" },
    { name: "Bamenda Fintech SA", type: "Fintech", date: "2025-01-14", status: "under_review" },
    { name: "Yaoundé Commercial Bank", type: "Bank", date: "2025-01-13", status: "pending" }
  ];

  const recentActivity = [
    { institution: "Cameroon National Bank", action: "API key generated", time: "2 hours ago" },
    { institution: "Trust Credit Union", action: "Payment initiated", time: "3 hours ago" },
    { institution: "Mobile Money Cameroon", action: "Account verified", time: "5 hours ago" },
    { institution: "Littoral Bank", action: "Integration completed", time: "1 day ago" }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage institutions, monitor API usage, and oversee platform operations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Pending Applications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Pending Applications
                <span className="text-sm font-normal text-muted-foreground">
                  {pendingApplications.length} pending
                </span>
              </CardTitle>
              <CardDescription>New institution registration requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingApplications.map((app, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{app.name}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{app.type}</span>
                        <span>•</span>
                        <span>{app.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.status === "pending" ? (
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium">Pending</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-primary">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Review</span>
                        </div>
                      )}
                      <Button size="sm" variant="outline">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Applications
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform events and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold mb-1 truncate">{activity.institution}</div>
                      <div className="text-sm text-muted-foreground">{activity.action}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <Button className="h-auto py-4 flex-col gap-2" variant="outline">
                  <Users className="h-6 w-6" />
                  <span className="text-sm">Manage Institutions</span>
                </Button>
                <Button className="h-auto py-4 flex-col gap-2" variant="outline">
                  <Activity className="h-6 w-6" />
                  <span className="text-sm">View Analytics</span>
                </Button>
                <Button className="h-auto py-4 flex-col gap-2" variant="outline">
                  <Shield className="h-6 w-6" />
                  <span className="text-sm">Security Settings</span>
                </Button>
                <Button className="h-auto py-4 flex-col gap-2" variant="outline">
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-sm">System Alerts</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default Admin;
