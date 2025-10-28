import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, Shield, Users } from "lucide-react";

interface LoanProductCardProps {
  product: any;
  onApply: (product: any) => void;
}

export default function LoanProductCard({ product, onApply }: LoanProductCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{product.product_name}</CardTitle>
            <CardDescription className="mt-1">{product.description}</CardDescription>
          </div>
          <Badge variant="secondary">{product.loan_type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount Range</span>
            <span className="font-medium">
              {Number(product.min_amount).toLocaleString()} - {Number(product.max_amount).toLocaleString()} XAF
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Interest Rate</span>
            </div>
            <span className="font-medium">{product.interest_rate}% per annum</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Tenure</span>
            </div>
            <span className="font-medium">
              {product.min_tenure_months}-{product.max_tenure_months} months
            </span>
          </div>

          {product.requires_collateral && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Collateral required</span>
            </div>
          )}

          {product.requires_guarantor && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{product.min_guarantors} guarantor(s) required</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Processing Fee</p>
          <p className="text-sm font-medium">
            {product.processing_fee_percentage > 0 && `${product.processing_fee_percentage}%`}
            {product.processing_fee_percentage > 0 && product.processing_fee_fixed > 0 && ' + '}
            {product.processing_fee_fixed > 0 && `${Number(product.processing_fee_fixed).toLocaleString()} XAF`}
            {!product.processing_fee_percentage && !product.processing_fee_fixed && 'No processing fee'}
          </p>
        </div>

        <Button onClick={() => onApply(product)} className="w-full">
          Apply Now
        </Button>
      </CardContent>
    </Card>
  );
}
