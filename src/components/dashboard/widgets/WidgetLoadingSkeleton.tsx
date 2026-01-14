import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface WidgetLoadingSkeletonProps {
  showHeader?: boolean;
  rows?: number;
}

export const WidgetLoadingSkeleton = ({ showHeader = true, rows = 3 }: WidgetLoadingSkeletonProps) => {
  return (
    <Card className="h-full">
      {showHeader && (
        <CardHeader className="py-2 px-3">
          <div className="h-4 w-24 skeleton-shimmer rounded" />
        </CardHeader>
      )}
      <CardContent className="px-3 pb-3 pt-0 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-8 w-8 skeleton-shimmer rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 skeleton-shimmer rounded" />
              <div className="h-2 w-1/2 skeleton-shimmer rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
