import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface InlineEditCellProps {
  value: string | number | undefined | null;
  onSave: (newValue: string) => Promise<void>;
  type?: "text" | "select" | "badge";
  options?: { value: string; label: string; color?: string }[];
  className?: string;
  disabled?: boolean;
}

export const InlineEditCell = ({
  value,
  onSave,
  type = "text",
  options = [],
  className,
  disabled = false,
}: InlineEditCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ""));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (editValue === String(value || "")) {
      setIsEditing(false);
      return;
    }
    
    try {
      setIsSaving(true);
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
      setEditValue(String(value || ""));
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(String(value || ""));
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const handleDoubleClick = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
    }
  }, [disabled]);

  const handleSelectChange = useCallback(async (newValue: string) => {
    setEditValue(newValue);
    try {
      setIsSaving(true);
      await onSave(newValue);
    } catch (error) {
      console.error("Failed to save:", error);
      setEditValue(String(value || ""));
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [onSave, value]);

  if (type === "select" || type === "badge") {
    if (isEditing) {
      return (
        <Select value={editValue} onValueChange={handleSelectChange} disabled={isSaving}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.filter((opt) => opt.value && opt.value.trim() !== '').map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    const currentOption = options.find((opt) => opt.value === String(value));
    
    return (
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors",
          disabled && "cursor-default",
          className
        )}
        title="Double-click to edit"
      >
        {type === "badge" && currentOption ? (
          <Badge variant="outline" className={cn("text-xs", currentOption.color)}>
            {currentOption.label}
          </Badge>
        ) : (
          <span className="text-sm">{currentOption?.label || value || "-"}</span>
        )}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-7 text-sm px-2 py-1"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
          aria-label="Save"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
          aria-label="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors truncate",
        disabled && "cursor-default",
        className
      )}
      title="Double-click to edit"
    >
      <span className="text-sm">{value || "-"}</span>
    </div>
  );
};
