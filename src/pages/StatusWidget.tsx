import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface SystemStatus {
  status: "operational" | "degraded" | "down";
  responseTime: number;
  uptime: number;
  lastChecked: string;
}

const StatusWidget = () => {
  const [status, setStatus] = useState<SystemStatus>({
    status: "operational",
    responseTime: 0,
    uptime: 99.9,
    lastChecked: new Date().toISOString()
  });

  useEffect(() => {
    const checkHealth = async () => {
      const startTime = Date.now();
      try {
        const response = await fetch("https://api.kangopenbanking.com/functions/v1/api-health");
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (response.ok) {
          setStatus({
            status: "operational",
            responseTime,
            uptime: 99.9,
            lastChecked: new Date().toISOString()
          });
        } else {
          setStatus({
            status: "degraded",
            responseTime,
            uptime: 99.5,
            lastChecked: new Date().toISOString()
          });
        }
      } catch (error) {
        setStatus({
          status: "down",
          responseTime: 0,
          uptime: 0,
          lastChecked: new Date().toISOString()
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status.status) {
      case "operational": return "text-green-500";
      case "degraded": return "text-yellow-500";
      case "down": return "text-red-500";
    }
  };

  const getStatusBg = () => {
    switch (status.status) {
      case "operational": return "bg-green-500";
      case "degraded": return "bg-yellow-500";
      case "down": return "bg-red-500";
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case "operational": return "All Systems Operational";
      case "degraded": return "Degraded Performance";
      case "down": return "Service Disruption";
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {status.status === "operational" ? (
            <CheckCircle2 className={`h-5 w-5 ${getStatusColor()}`} />
          ) : (
            <AlertCircle className={`h-5 w-5 ${getStatusColor()}`} />
          )}
          <div>
            <h3 className="font-semibold text-gray-900">Kang Open Banking API</h3>
            <p className="text-sm text-gray-600">Status Dashboard</p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusBg()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Clock className="h-4 w-4" />
            Response Time
          </div>
          <p className="text-2xl font-bold text-gray-900">{status.responseTime}ms</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">
          <div className="text-sm text-gray-600 mb-1">Uptime</div>
          <p className="text-2xl font-bold text-gray-900">{status.uptime}%</p>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-4 text-center">
        Last updated: {new Date(status.lastChecked).toLocaleTimeString()}
      </p>
    </div>
  );
};

export default StatusWidget;
