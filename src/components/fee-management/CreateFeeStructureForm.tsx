import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateFeeStructureFormProps {
  institutions: any[];
  onSubmit: (formData: any) => void;
  onCancel: () => void;
}

export function CreateFeeStructureForm({ institutions, onSubmit, onCancel }: CreateFeeStructureFormProps) {
  const [formData, setFormData] = useState({
    institution_id: '',
    transaction_type: 'transfer',
    fee_model: 'fixed',
    fixed_amount: 0,
    percentage_rate: 0,
    min_fee_amount: 0,
    max_fee_amount: null as number | null,
    effective_from: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Institution</Label>
        <Select 
          value={formData.institution_id} 
          onValueChange={(v) => setFormData({...formData, institution_id: v})}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select institution" />
          </SelectTrigger>
          <SelectContent>
            {institutions.map((inst: any) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Transaction Type</Label>
        <Select 
          value={formData.transaction_type} 
          onValueChange={(v) => setFormData({...formData, transaction_type: v})}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transfer">Account Transfer</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="bill_payment">Bill Payment</SelectItem>
            <SelectItem value="mobile_money_transfer">Mobile Money Transfer</SelectItem>
            <SelectItem value="mobile_money_charge">Mobile Money Charge</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Fee Model</Label>
        <Select 
          value={formData.fee_model} 
          onValueChange={(v) => setFormData({...formData, fee_model: v})}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed Amount</SelectItem>
            <SelectItem value="percentage">Percentage Only</SelectItem>
            <SelectItem value="hybrid">Fixed + Percentage</SelectItem>
            <SelectItem value="tiered">Tiered (Volume-based)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(formData.fee_model === 'fixed' || formData.fee_model === 'hybrid') && (
        <div>
          <Label>Fixed Amount (XAF)</Label>
          <Input 
            type="number" 
            value={formData.fixed_amount}
            onChange={(e) => setFormData({...formData, fixed_amount: Number(e.target.value)})}
          />
        </div>
      )}

      {(formData.fee_model === 'percentage' || formData.fee_model === 'hybrid') && (
        <>
          <div>
            <Label>Percentage Rate (%)</Label>
            <Input 
              type="number" 
              step="0.01"
              value={formData.percentage_rate}
              onChange={(e) => setFormData({...formData, percentage_rate: Number(e.target.value)})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Minimum Fee (XAF)</Label>
              <Input 
                type="number"
                value={formData.min_fee_amount}
                onChange={(e) => setFormData({...formData, min_fee_amount: Number(e.target.value)})}
              />
            </div>
            <div>
              <Label>Maximum Fee (XAF)</Label>
              <Input 
                type="number"
                value={formData.max_fee_amount || ''}
                onChange={(e) => setFormData({...formData, max_fee_amount: e.target.value ? Number(e.target.value) : null})}
                placeholder="No cap"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <Label>Effective From</Label>
        <Input 
          type="date"
          value={formData.effective_from}
          onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">Create Fee Structure</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
