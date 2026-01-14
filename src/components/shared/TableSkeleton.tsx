import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  className?: string;
}

export const TableSkeleton = ({
  columns = 5,
  rows = 8,
  showHeader = true,
  className,
}: TableSkeletonProps) => {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border", className)}>
      {showHeader && (
        <div className="flex items-center gap-4 bg-muted/30 px-4 py-3 border-b border-border">
          {Array.from({ length: columns }).map((_, i) => (
            <div 
              key={`header-${i}`} 
              className={cn(
                "h-4 rounded skeleton-shimmer",
                i === 0 ? "w-8" : i === 1 ? "w-32" : "w-24"
              )} 
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`} 
            className="flex items-center gap-4 px-4 py-3 bg-card"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={`cell-${rowIndex}-${colIndex}`} 
                className={cn(
                  "h-4 rounded skeleton-shimmer",
                  colIndex === 0 ? "w-4" : 
                  colIndex === 1 ? "w-40" : 
                  colIndex === columns - 1 ? "w-20" : "w-28"
                )} 
                style={{ animationDelay: `${rowIndex * 0.05}s` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
