import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateSavingsFormProps {
  products: any[];
  onSuccess: () => void;
  onCancel: () => void;
}

export const CreateSavingsForm = ({ products, onSuccess, onCancel }: CreateSavingsFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_id: "",
    account_name: "",
    opening_deposit: "",
    target_amount: "",
    target_date: "",
    auto_save_enabled: false,
    auto_save_amount: "",
    auto_save_frequency: "monthly",
    auto_save_day: "1",
  });

  const selectedProduct = products.find(p => p.id === formData.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('savings-create', {
        body: {
          product_id: formData.product_id,
          account_name: formData.account_name,
          opening_deposit: parseFloat(formData.opening_deposit),
          target_amount: formData.target_amount ? parseFloat(formData.target_amount) : null,
          target_date: formData.target_date || null,
          auto_save_settings: formData.auto_save_enabled ? {
            enabled: true,
            amount: parseFloat(formData.auto_save_amount),
            frequency: formData.auto_save_frequency,
            day: parseInt(formData.auto_save_day),
          } : null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Savings account created successfully",
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error creating savings account:', error);
      
      let errorMessage = "Failed to create savings account";
      
      // Extract specific error messages
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Open Savings Account</DialogTitle>
          <DialogDescription>
            Choose a savings product and set up your account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product_id">Savings Product *</Label>
            <Select value={formData.product_id} onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.product_name} - {product.base_interest_rate}% p.a.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="account_name">Account Name *</Label>
            <Input
              id="account_name"
              value={formData.account_name}
              onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              placeholder="e.g., Holiday Fund, Emergency Savings"
              required
            />
          </div>

          <div>
            <Label htmlFor="opening_deposit">Opening Deposit (XAF) *</Label>
            <Input
              id="opening_deposit"
              type="number"
              value={formData.opening_deposit}
              onChange={(e) => setFormData({ ...formData, opening_deposit: e.target.value })}
              placeholder={selectedProduct ? `Min: ${selectedProduct.min_opening_balance}` : ""}
              required
              min={selectedProduct?.min_opening_balance || 0}
            />
          </div>

          {selectedProduct?.savings_type === 'goal_savings' && (
            <>
              <div>
                <Label htmlFor="target_amount">Target Amount (XAF)</Label>
                <Input
                  id="target_amount"
                  type="number"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  placeholder="Your savings goal"
                />
              </div>

              <div>
                <Label htmlFor="target_date">Target Date</Label>
                <Input
                  id="target_date"
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto_save"
                  checked={formData.auto_save_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_save_enabled: checked as boolean })}
                />
                <Label htmlFor="auto_save" className="cursor-pointer">
                  Enable Automatic Savings
                </Label>
              </div>

              {formData.auto_save_enabled && (
                <div className="grid grid-cols-3 gap-4 ml-6">
                  <div>
                    <Label htmlFor="auto_save_amount">Amount (XAF)</Label>
                    <Input
                      id="auto_save_amount"
                      type="number"
                      value={formData.auto_save_amount}
                      onChange={(e) => setFormData({ ...formData, auto_save_amount: e.target.value })}
                      required={formData.auto_save_enabled}
                    />
                  </div>
                  <div>
                    <Label htmlFor="auto_save_frequency">Frequency</Label>
                    <Select value={formData.auto_save_frequency} onValueChange={(value) => setFormData({ ...formData, auto_save_frequency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="auto_save_day">Day</Label>
                    <Input
                      id="auto_save_day"
                      type="number"
                      value={formData.auto_save_day}
                      onChange={(e) => setFormData({ ...formData, auto_save_day: e.target.value })}
                      min="1"
                      max={formData.auto_save_frequency === 'monthly' ? '31' : formData.auto_save_frequency === 'weekly' ? '7' : '1'}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
