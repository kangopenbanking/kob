import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface RepaymentScheduleProps {
  schedules: any[];
}

export default function RepaymentSchedule({ schedules }: RepaymentScheduleProps) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No repayment schedule available
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (status === 'paid') {
      return <Badge variant="default" className="bg-green-600">Paid</Badge>;
    }
    if (daysOverdue > 0) {
      return <Badge variant="destructive">Overdue ({daysOverdue}d)</Badge>;
    }
    if (status === 'partial') {
      return <Badge variant="secondary">Partial</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead className="text-right">Total Due</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell>{getStatusIcon(schedule.status)}</TableCell>
              <TableCell className="font-medium">{schedule.installment_number}</TableCell>
              <TableCell>
                {new Date(schedule.due_date).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                {Number(schedule.principal_due).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {Number(schedule.interest_due).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-medium">
                {Number(schedule.total_due).toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-green-600">
                {Number(schedule.total_paid).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {Number(schedule.outstanding_balance).toLocaleString()}
              </TableCell>
              <TableCell>
                {getStatusBadge(schedule.status, schedule.days_overdue || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
