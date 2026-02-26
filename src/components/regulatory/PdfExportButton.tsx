import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useRegulatoryPdfExport } from "@/hooks/useRegulatoryPdfExport";

interface PdfExportButtonProps {
  title: string;
  documentCode: string;
  subtitle?: string;
  sections: {
    heading: string;
    content: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

export function PdfExportButton({ title, documentCode, subtitle, sections }: PdfExportButtonProps) {
  const { exportToPdf } = useRegulatoryPdfExport();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => exportToPdf({ title, documentCode, subtitle, sections })}
    >
      <Download className="h-4 w-4" />
      Export PDF
    </Button>
  );
}
