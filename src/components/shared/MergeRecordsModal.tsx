import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, GitMerge, ArrowRight } from "lucide-react";

type EntityType = "leads" | "contacts" | "accounts";

interface MergeRecordsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  sourceId: string;
  targetId: string;
  onSuccess: () => void;
}

interface FieldConfig {
  key: string;
  label: string;
  sourceValue: string | null;
  targetValue: string | null;
}

const fieldLabels: Record<string, string> = {
  lead_name: "Name",
  contact_name: "Name",
  company_name: "Company",
  position: "Position",
  email: "Email",
  phone_no: "Phone",
  linkedin: "LinkedIn",
  website: "Website",
  contact_source: "Source",
  industry: "Industry",
  region: "Region",
  country: "Country",
  description: "Description",
  lead_status: "Status",
  status: "Status",
  notes: "Notes",
  tags: "Tags",
};

const mergeableFields: Record<EntityType, string[]> = {
  leads: [
    "lead_name",
    "company_name",
    "position",
    "email",
    "phone_no",
    "linkedin",
    "website",
    "contact_source",
    "industry",
    "country",
    "description",
    "lead_status",
  ],
  contacts: [
    "contact_name",
    "company_name",
    "position",
    "email",
    "phone_no",
    "linkedin",
    "website",
    "contact_source",
    "industry",
    "region",
    "description",
    "tags",
  ],
  accounts: [
    "company_name",
    "email",
    "phone",
    "website",
    "industry",
    "region",
    "country",
    "company_type",
    "status",
    "notes",
    "tags",
  ],
};

export const MergeRecordsModal = ({
  open,
  onOpenChange,
  entityType,
  sourceId,
  targetId,
  onSuccess,
}: MergeRecordsModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isMerging, setIsMerging] = useState(false);
  const [sourceRecord, setSourceRecord] = useState<Record<string, unknown> | null>(null);
  const [targetRecord, setTargetRecord] = useState<Record<string, unknown> | null>(null);
  const [fieldSelections, setFieldSelections] = useState<Record<string, "source" | "target">>({});
  const [fields, setFields] = useState<FieldConfig[]>([]);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sourceRes, targetRes] = await Promise.all([
        supabase.from(entityType).select("*").eq("id", sourceId).single(),
        supabase.from(entityType).select("*").eq("id", targetId).single(),
      ]);

      if (sourceRes.error) throw sourceRes.error;
      if (targetRes.error) throw targetRes.error;

      setSourceRecord(sourceRes.data);
      setTargetRecord(targetRes.data);

      // Build fields configuration
      const fieldsConfig: FieldConfig[] = [];
      const selections: Record<string, "source" | "target"> = {};

      for (const key of mergeableFields[entityType]) {
        const sourceVal = sourceRes.data[key];
        const targetVal = targetRes.data[key];

        const formatValue = (val: unknown): string | null => {
          if (val === null || val === undefined) return null;
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        };

        fieldsConfig.push({
          key,
          label: fieldLabels[key] || key,
          sourceValue: formatValue(sourceVal),
          targetValue: formatValue(targetVal),
        });

        // Default to target if it has a value, otherwise source
        selections[key] = targetVal ? "target" : sourceVal ? "source" : "target";
      }

      setFields(fieldsConfig);
      setFieldSelections(selections);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({
        title: "Error",
        description: "Failed to load records for merging.",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, sourceId, targetId, toast, onOpenChange]);

  useEffect(() => {
    if (open && sourceId && targetId) {
      fetchRecords();
    }
  }, [open, sourceId, targetId, fetchRecords]);

  const handleFieldSelection = (fieldKey: string, value: "source" | "target") => {
    setFieldSelections((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleMerge = async () => {
    if (!sourceRecord || !targetRecord) return;

    setIsMerging(true);
    try {
      // Build merged data
      const mergedData: Record<string, unknown> = {};

      for (const field of fields) {
        const selection = fieldSelections[field.key];
        const sourceVal = sourceRecord[field.key];
        const targetVal = targetRecord[field.key];

        mergedData[field.key] = selection === "source" ? sourceVal : targetVal;
      }

      // Update target record with merged data
      const { error: updateError } = await supabase
        .from(entityType)
        .update({
          ...mergedData,
          modified_time: new Date().toISOString(),
        })
        .eq("id", targetId);

      if (updateError) throw updateError;

      // Delete source record
      const { error: deleteError } = await supabase
        .from(entityType)
        .delete()
        .eq("id", sourceId);

      if (deleteError) {
        console.warn("Could not delete source record:", deleteError);
        // Continue anyway, the merge was successful
      }

      toast({
        title: "Success",
        description: "Records merged successfully.",
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [entityType] });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error merging records:", error);
      toast({
        title: "Error",
        description: "Failed to merge records.",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const getEntityLabel = () => {
    switch (entityType) {
      case "leads":
        return "lead";
      case "contacts":
        return "contact";
      case "accounts":
        return "account";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Merge {getEntityLabel()}s
          </DialogTitle>
          <DialogDescription>
            Choose which values to keep for each field. The source record will be deleted after merging.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading records...</span>
          </div>
        ) : (
          <>
            {/* Column Headers */}
            <div className="grid grid-cols-[1fr_1fr_auto_1fr] gap-2 px-4 py-2 border-b bg-muted/30 font-medium text-sm">
              <div>Field</div>
              <div className="text-center">Source (will be deleted)</div>
              <div></div>
              <div className="text-center">Target (will be kept)</div>
            </div>

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1 p-2">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-[1fr_1fr_auto_1fr] gap-2 items-center py-2 px-2 rounded hover:bg-muted/50"
                  >
                    <div className="font-medium text-sm">{field.label}</div>
                    
                    <RadioGroup
                      value={fieldSelections[field.key]}
                      onValueChange={(value) =>
                        handleFieldSelection(field.key, value as "source" | "target")
                      }
                      className="contents"
                    >
                      <div className="flex items-center justify-center">
                        <Label
                          htmlFor={`${field.key}-source`}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${
                            fieldSelections[field.key] === "source"
                              ? "border-primary bg-primary/10"
                              : "border-border"
                          } ${!field.sourceValue ? "opacity-50" : ""}`}
                        >
                          <RadioGroupItem
                            value="source"
                            id={`${field.key}-source`}
                            disabled={!field.sourceValue}
                          />
                          <span className="truncate max-w-[120px]">
                            {field.sourceValue || "-"}
                          </span>
                        </Label>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" />

                      <div className="flex items-center justify-center">
                        <Label
                          htmlFor={`${field.key}-target`}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${
                            fieldSelections[field.key] === "target"
                              ? "border-primary bg-primary/10"
                              : "border-border"
                          } ${!field.targetValue ? "opacity-50" : ""}`}
                        >
                          <RadioGroupItem
                            value="target"
                            id={`${field.key}-target`}
                            disabled={!field.targetValue && !field.sourceValue}
                          />
                          <span className="truncate max-w-[120px]">
                            {field.targetValue || "-"}
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleMerge} disabled={isMerging}>
                {isMerging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Merge Records
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
