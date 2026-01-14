import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, GitMerge } from "lucide-react";

interface DuplicateWarningProps {
  duplicates: Array<{
    id: string;
    name: string;
    email?: string;
    matchType: "exact" | "similar";
  }>;
  entityType?: string;
  onMerge?: (duplicateId: string) => void;
  onViewRecord?: (duplicateId: string) => void;
  preventCreation?: boolean;
}

export const DuplicateWarning = ({
  duplicates,
  entityType = "record",
  onMerge,
  onViewRecord,
  preventCreation = false,
}: DuplicateWarningProps) => {
  if (duplicates.length === 0) return null;

  const hasExact = duplicates.some((d) => d.matchType === "exact");

  return (
    <Alert variant={hasExact ? "destructive" : "default"} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="ml-2">
          <p className="font-medium">
            {hasExact
              ? `Possible duplicate ${entityType} found`
              : `Similar ${entityType}s found`}
          </p>
          {preventCreation && hasExact && (
            <p className="text-sm text-destructive mt-1">
              Please use a different email or merge with the existing record.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {duplicates.slice(0, 3).map((dup) => (
              <li key={dup.id} className="flex items-center justify-between gap-2 p-2 bg-background/50 rounded">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{dup.name}</span>
                  {dup.email && (
                    <span className="text-muted-foreground text-sm truncate">({dup.email})</span>
                  )}
                  {dup.matchType === "exact" && (
                    <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded whitespace-nowrap">
                      Exact match
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {onViewRecord && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => onViewRecord(dup.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onMerge && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => onMerge(dup.id)}
                    >
                      <GitMerge className="h-3.5 w-3.5 mr-1" />
                      Merge
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {duplicates.length > 3 && (
            <p className="text-xs text-muted-foreground mt-2">
              + {duplicates.length - 3} more
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
