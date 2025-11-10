import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

interface Widget {
  id: string;
  widget_type: string;
  is_visible: boolean;
  size: string;
}

interface WidgetOption {
  type: string;
  name: string;
  description: string;
}

const availableWidgets: WidgetOption[] = [
  { type: "balance", name: "Total Balance", description: "View your total account balance" },
  { type: "transactions", name: "Recent Transactions", description: "Latest account activity" },
  { type: "credit_score", name: "Credit Score", description: "Your current credit score" },
  { type: "quick_actions", name: "Quick Actions", description: "Frequently used actions" },
  { type: "activity_feed", name: "Activity Feed", description: "Recent account updates" },
  { type: "savings_goals", name: "Savings Goals", description: "Track your savings progress" },
];

interface WidgetCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function WidgetCustomizer({ open, onOpenChange, onUpdate }: WidgetCustomizerProps) {
  const [loading, setLoading] = useState(false);
  const [userWidgets, setUserWidgets] = useState<Widget[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadUserWidgets();
    }
  }, [open]);

  const loadUserWidgets = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("dashboard_widgets")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserWidgets(data || []);
    } catch (error) {
      console.error("Error loading widgets:", error);
      toast.error("Failed to load widgets");
    } finally {
      setLoading(false);
    }
  };

  const isWidgetEnabled = (type: string) => {
    return userWidgets.some((w) => w.widget_type === type && w.is_visible);
  };

  const toggleWidget = async (type: string, enabled: boolean) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingWidget = userWidgets.find((w) => w.widget_type === type);

      if (existingWidget) {
        // Update existing widget
        const { error } = await supabase
          .from("dashboard_widgets")
          .update({ is_visible: enabled })
          .eq("id", existingWidget.id);

        if (error) throw error;
      } else if (enabled) {
        // Create new widget
        const { error } = await supabase.from("dashboard_widgets").insert({
          user_id: user.id,
          widget_type: type,
          is_visible: true,
          position: userWidgets.length,
        });

        if (error) throw error;
      }

      await loadUserWidgets();
      onUpdate();
      toast.success("Widget updated");
    } catch (error) {
      console.error("Error updating widget:", error);
      toast.error("Failed to update widget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Choose which widgets to display on your dashboard
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {availableWidgets.map((widget) => (
              <div
                key={widget.type}
                className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={widget.type}
                  checked={isWidgetEnabled(widget.type)}
                  onCheckedChange={(checked) =>
                    toggleWidget(widget.type, checked as boolean)
                  }
                  disabled={saving}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={widget.type}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {widget.name}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {widget.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
