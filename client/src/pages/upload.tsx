import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Papa from "papaparse";
import { useLocation } from "wouter";

const REQUIRED_FIELDS = [
  { key: "invoice_number", label: "Invoice Number", required: true },
  { key: "due_date", label: "Due Date", required: true },
  { key: "amount_remaining", label: "Amount Remaining", required: true },
  { key: "status", label: "Status", required: false },
  { key: "hold_flag", label: "Hold Flag", required: false },
  { key: "vendor_name", label: "Vendor Name", required: true },
];

type MappingStep = "upload" | "mapping" | "preview" | "done";

export default function UploadPage() {
  const [step, setStep] = useState<MappingStep>("upload");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: restaurants } = useQuery<any[]>({
    queryKey: ["/api/restaurants"],
  });

  const restaurantId = restaurants?.[0]?.id || "";

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            toast({
              title: "Empty CSV",
              description: "The file contains no data rows.",
              variant: "destructive",
            });
            return;
          }
          const headers = results.meta.fields || [];
          setCsvHeaders(headers);
          setCsvData(results.data);

          const autoMap: Record<string, string> = {};
          REQUIRED_FIELDS.forEach((field) => {
            const match = headers.find(
              (h) =>
                h.toLowerCase().replace(/[^a-z0-9]/g, "") ===
                field.key.replace(/_/g, "")
            );
            if (match) autoMap[field.key] = match;
          });
          setMapping(autoMap);
          setStep("mapping");
        },
        error: () => {
          toast({
            title: "Parse Error",
            description: "Could not parse the CSV file.",
            variant: "destructive",
          });
        },
      });
    },
    [toast]
  );

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invoices/upload", {
        restaurantId,
        mapping,
        rows: csvData,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Complete",
        description: `${data.count} invoices uploaded successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setStep("done");
    },
    onError: (err: Error) => {
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const requiredMapped = REQUIRED_FIELDS.filter((f) => f.required).every(
    (f) => mapping[f.key]
  );

  const previewData = csvData.slice(0, 5).map((row) => {
    const mapped: Record<string, any> = {};
    Object.entries(mapping).forEach(([field, header]) => {
      mapped[field] = row[header];
    });
    return mapped;
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Upload Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import invoices from a CSV file
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {["Upload", "Map Columns", "Preview", "Done"].map((label, i) => {
          const stepIdx = ["upload", "mapping", "preview", "done"].indexOf(step);
          const isActive = i === stepIdx;
          const isDone = i < stepIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {isDone && <CheckCircle className="w-3 h-3" />}
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {step === "upload" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-md bg-accent">
                <FileSpreadsheet className="w-8 h-8 text-accent-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drag and drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV files only. Include headers in the first row.
                </p>
              </div>
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <Button asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </span>
                </Button>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-csv-file"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold">Map CSV Columns</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fileName} - {csvData.length} rows detected
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStep("upload");
                  setCsvData([]);
                  setCsvHeaders([]);
                  setMapping({});
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3 flex-wrap">
                <Label className="w-36 text-sm flex items-center gap-1">
                  {field.label}
                  {field.required && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <Select
                  value={mapping[field.key] || ""}
                  onValueChange={(val) =>
                    setMapping((m) => ({ ...m, [field.key]: val }))
                  }
                >
                  <SelectTrigger
                    className="w-56"
                    data-testid={`select-mapping-${field.key}`}
                  >
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="flex justify-end pt-4">
              <Button
                disabled={!requiredMapped}
                onClick={() => setStep("preview")}
                data-testid="button-next-preview"
              >
                Preview
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="text-sm font-semibold">Preview Mapped Data</h3>
            <p className="text-xs text-muted-foreground">
              Showing first {previewData.length} of {csvData.length} rows
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {REQUIRED_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <th
                        key={f.key}
                        className="text-left py-2 px-3 text-xs font-medium text-muted-foreground"
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {REQUIRED_FIELDS.filter((f) => mapping[f.key]).map(
                        (f) => (
                          <td key={f.key} className="py-2 px-3">
                            {String(row[f.key] ?? "")}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2 pt-4 flex-wrap">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-confirm"
              >
                {uploadMutation.isPending
                  ? "Uploading..."
                  : `Upload ${csvData.length} Invoices`}
                <Upload className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-md bg-chart-2/10">
                <CheckCircle className="w-8 h-8 text-chart-2" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Upload Complete</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Invoices have been processed and eligibility checked.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload");
                    setCsvData([]);
                    setCsvHeaders([]);
                    setMapping({});
                  }}
                >
                  Upload More
                </Button>
                <Button onClick={() => navigate(`/restaurants/${restaurantId}/vendors`)}>
                  View Invoices
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
