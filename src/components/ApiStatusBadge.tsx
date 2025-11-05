import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export function ApiStatusBadge() {
  const [status, setStatus] = useState<"operational" | "degraded" | "down" | "checking">("checking");
  const [responseTime, setResponseTime] = useState<number | null>(null);

  useEffect(() => {
    const checkApiHealth = async () => {
      const startTime = performance.now();
      
      try {
        const { error } = await supabase.functions.invoke('api-health', {
          method: 'GET'
        });
        
        const endTime = performance.now();
        const time = Math.round(endTime - startTime);
        setResponseTime(time);
        
        if (error) {
          setStatus("degraded");
        } else {
          setStatus(time < 500 ? "operational" : "degraded");
        }
      } catch (error) {
        setStatus("down");
      }
    };

    checkApiHealth();
    // Check every 60 seconds
    const interval = setInterval(checkApiHealth, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "operational":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: "All Systems Operational",
          color: "bg-green-500/10 text-green-600 border-green-500/20",
          detail: responseTime ? `${responseTime}ms` : null
        };
      case "degraded":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: "Degraded Performance",
          color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
          detail: responseTime ? `${responseTime}ms` : null
        };
      case "down":
        return {
          icon: <XCircle className="h-4 w-4" />,
          text: "Service Issues",
          color: "bg-red-500/10 text-red-600 border-red-500/20",
          detail: null
        };
      default:
        return {
          icon: <Activity className="h-4 w-4 animate-pulse" />,
          text: "Checking Status...",
          color: "bg-muted text-muted-foreground border-muted",
          detail: null
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Link to="/status">
      <Badge 
        variant="outline" 
        className={`${config.color} px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {config.icon}
        <span className="ml-2">{config.text}</span>
        {config.detail && (
          <span className="ml-2 opacity-75">• {config.detail}</span>
        )}
      </Badge>
    </Link>
  );
}
