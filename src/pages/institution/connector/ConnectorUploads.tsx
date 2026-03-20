import { useState } from "react";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, RefreshCw, Loader2, Eye, Play } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const FILE_TYPES = ["accounts", "balances", "transactions", "beneficiaries"] as const;

export default function ConnectorUploads() {
  const { bankId, loading: bankLoading } = useBankConnector();
  const queryClient = useQueryClient();
  const [fileType, setFileType] = useState<string>("accounts");
  const [environment, setEnvironment] = useState<string>("sandbox");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);

  const { data: uploads, isLoading, refetch } = useQuery({
    queryKey: ["connector-uploads", bankId, filterType],
    queryFn: async () => {
      if (!bankId) return [];
      let query = supabase
        .from("bank_file_uploads")
        .select("*")
        .eq("bank_id", bankId)
        .order("received_at", { ascending: false })
        .limit(100);
      if (filterType !== "all") query = query.eq("file_type", filterType);
      const { data } = await query;
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: detail } = useQuery({
    queryKey: ["connector-upload-detail", detailId],
    queryFn: async () => {
      if (!detailId) return null;
      const { data: file } = await supabase
        .from("bank_file_uploads")
        .select("*")
        .eq("id", detailId)
        .single();
      const { data: rows } = await supabase
        .from("bank_file_rows")
        .select("*")
        .eq("file_id", detailId)
        .eq("status", "invalid")
        .limit(50);
      return { file, errorRows: rows ?? [] };
    },
    enabled: !!detailId,
  });

  const handleUpload = async () => {
    if (!selectedFile || !bankId) return;
    setUploading(true);
    try {
      const fileContent = await selectedFile.text();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke("bank-file-connector", {
        body: {
          action: "upload_file",
          bank_id: bankId,
          file_type: fileType,
          environment,
          file_content: fileContent,
          filename: selectedFile.name,
          uploaded_by: "portal",
          uploader_user_id: user?.id ?? null,
        },
      });

      if (error) throw error;

      // Check for edge function error responses (non-2xx wrapped in data)
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("File uploaded and registered successfully");
      setSelectedFile(null);

      // Auto-trigger ingestion if file was registered
      if (data?.file?.id) {
        toast.info("Starting ingestion...");
        await handleRunIngestion(data.file.id);
      }

      refetch();
    } catch (err: any) {
      const msg = err?.message || "Upload failed";
      if (msg.includes("Duplicate file")) {
        toast.error("This file has already been uploaded (duplicate content detected)");
      } else {
        toast.error(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRunIngestion = async (fileId: string) => {
    setIngesting(fileId);
    try {
      const { data, error } = await supabase.functions.invoke("bank-file-connector", {
        body: { action: "run_ingestion", file_id: fileId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const totals = data?.totals;
      toast.success(
        `Ingestion complete: ${totals?.rows_ok ?? 0} OK, ${totals?.rows_invalid ?? 0} invalid, ${totals?.rows_duplicate ?? 0} duplicates`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["connector-upload-detail"] });
    } catch (err: any) {
      toast.error(err?.message || "Ingestion failed");
    } finally {
      setIngesting(null);
    }
  };

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Upload} title="Uploads & Imports" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Upload} title="Uploads & Imports" description="Upload and monitor file ingestion" />
        <ConnectorEmptyState icon={Upload} title="No Bank Connected" description="Your institution needs an active bank profile to use file uploads." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={Upload} title="Uploads & Imports" description="Upload CSV files and monitor ingestion runs">
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </ConnectorPageHeader>

      {/* Upload Panel */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Upload File</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">File Type</label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILE_TYPES.map((ft) => <SelectItem key={ft} value={ft} className="capitalize">{ft}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Environment</label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">CSV File</label>
              <Input type="file" accept=".csv" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="w-64" />
            </div>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload & Ingest
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {FILE_TYPES.map((ft) => <SelectItem key={ft} value={ft} className="capitalize">{ft}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Imports Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : uploads && uploads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Received</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Filename</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Env</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{format(new Date(u.received_at), "MMM d, HH:mm")}</td>
                      <td className="p-3 capitalize">{u.file_type}</td>
                      <td className="p-3 max-w-[200px] truncate">{u.original_filename}</td>
                      <td className="p-3"><StatusBadge status={u.status} /></td>
                      <td className="p-3"><StatusBadge status={u.environment} /></td>
                      <td className="p-3 text-right flex items-center justify-end gap-1">
                        {u.status === "received" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunIngestion(u.id)}
                            disabled={ingesting === u.id}
                            title="Run ingestion"
                          >
                            {ingesting === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setDetailId(u.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectorEmptyState
              icon={FileText}
              title="No Imports Yet"
              description="Upload your first CSV file to start importing data into the platform."
              actionLabel="Upload File"
              onAction={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              showTemplateDownload
              onDownloadTemplate={() => window.open("/fi-portal/connector/templates")}
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import Details</DialogTitle></DialogHeader>
          {detail?.file && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Filename:</span> <span className="font-medium">{detail.file.original_filename}</span></div>
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{detail.file.file_type}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={detail.file.status} /></div>
                <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{detail.file.file_size ? `${Math.round(detail.file.file_size / 1024)} KB` : "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">SHA256:</span> <span className="font-mono text-xs break-all">{detail.file.file_hash_sha256}</span></div>
                {detail.file.error_summary && (
                  <div className="col-span-2"><span className="text-muted-foreground">Error:</span> <span className="text-destructive">{detail.file.error_summary}</span></div>
                )}
              </div>

              {detail.errorRows.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Error Rows (first 50)</h4>
                  <div className="border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-muted/50 border-b"><th className="p-2 text-left">Row</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Error</th></tr></thead>
                      <tbody>
                        {detail.errorRows.map((r) => (
                          <tr key={r.id} className="border-b border-border/50">
                            <td className="p-2">{r.row_number}</td>
                            <td className="p-2"><StatusBadge status={r.status} /></td>
                            <td className="p-2">{r.error_details || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
