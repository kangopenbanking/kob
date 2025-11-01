import { AdminLayout } from "@/components/admin/AdminLayout";
import { SettlementManagement } from "@/components/admin/SettlementManagement";

const PaymentFacilitation = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payment Facilitation</h1>
          <p className="text-muted-foreground mt-2">
            Manage KOB Flutterwave facilitation and settlements for developers and fintechs
          </p>
        </div>
        
        <SettlementManagement />
      </div>
    </AdminLayout>
  );
};

export default PaymentFacilitation;