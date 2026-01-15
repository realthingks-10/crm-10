import React, { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, GripVertical } from "lucide-react";
import { GridLayout, verticalCompactor, type Layout } from "react-grid-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import {
  WidgetKey,
  DEFAULT_WIDGETS,
  WidgetLayoutConfig,
  WidgetLayout,
} from "./DashboardCustomizeModal";

type LayoutItem = Layout[number];

interface ResizableDashboardProps {
  isResizeMode: boolean;
  visibleWidgets: WidgetKey[];
  widgetLayouts: WidgetLayoutConfig;
  pendingWidgetChanges?: Set<WidgetKey>;
  onLayoutChange: (layouts: WidgetLayoutConfig) => void;
  onWidgetRemove: (key: WidgetKey) => void;
  renderWidget: (key: WidgetKey) => React.ReactNode;
  containerWidth: number;
}

const COLS = 12;
const ROW_HEIGHT = 70;
const MARGIN: [number, number] = [8, 8];

export const ResizableDashboard = ({
  isResizeMode,
  visibleWidgets,
  widgetLayouts,
  pendingWidgetChanges,
  onLayoutChange,
  onWidgetRemove,
  renderWidget,
  containerWidth,
}: ResizableDashboardProps) => {
  if (!containerWidth || containerWidth < 320) {
    return (
      <div className="dashboard-grid w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleWidgets.slice(0, 8).map((key) => (
            <div key={key} className="h-32 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const effectiveWidth = Math.max(320, containerWidth);

  const layout: LayoutItem[] = useMemo(() => {
    const defaults = new Map<WidgetKey, WidgetLayout>();
    DEFAULT_WIDGETS.forEach((w) => defaults.set(w.key, w.defaultLayout));

    return visibleWidgets.map((key): LayoutItem => {
      const saved = widgetLayouts[key];
      const d = defaults.get(key) ?? { x: 0, y: 0, w: 3, h: 2 };
      const w = Math.max(2, Math.min(COLS, (saved?.w && saved.w > 0) ? saved.w : d.w));
      const h = Math.max(2, (saved?.h && saved.h > 0) ? saved.h : d.h);
      const rawX = (saved?.x !== undefined && saved.x >= 0) ? saved.x : d.x;
      const rawY = (saved?.y !== undefined && saved.y >= 0) ? saved.y : d.y;
      const maxX = Math.max(0, COLS - w);
      const x = Math.max(0, Math.min(maxX, rawX));
      return { i: key, x, y: rawY, w, h, minW: 2, minH: 2, maxW: COLS };
    });
  }, [visibleWidgets, widgetLayouts]);

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      const next: WidgetLayoutConfig = { ...widgetLayouts };
      newLayout.forEach((l) => {
        const key = l.i as WidgetKey;
        if (visibleWidgets.includes(key)) {
          const w = Math.max(2, Math.min(COLS, l.w));
          const maxX = Math.max(0, COLS - w);
          const x = Math.max(0, Math.min(maxX, l.x));
          next[key] = { x, y: l.y, w, h: l.h };
        }
      });
      onLayoutChange(next);
    },
    [visibleWidgets, widgetLayouts, onLayoutChange]
  );

  return (
    <div className="dashboard-grid w-full">
      <GridLayout
        className="layout w-full"
        layout={layout}
        width={effectiveWidth}
        gridConfig={{
          cols: COLS,
          rowHeight: ROW_HEIGHT,
          margin: MARGIN,
          containerPadding: [0, 0] as const,
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: isResizeMode,
          handle: ".dash-drag-handle",
        }}
        resizeConfig={{
          enabled: isResizeMode,
          handles: ["se"],
        }}
        compactor={verticalCompactor}
        onLayoutChange={handleLayoutChange}
        autoSize
      >
        {visibleWidgets.map((key) => {
          const isPendingRemoval = !!pendingWidgetChanges?.has(key);
          const itemClassName = ["dash-item", isResizeMode ? "dash-item--edit" : "", isResizeMode && isPendingRemoval ? "dash-item--pending-remove" : ""].filter(Boolean).join(" ");
          return (
            <div key={key} className={itemClassName}>
              {isResizeMode && isPendingRemoval && (<div className="dash-pending-badge" aria-hidden="true">Pending removal</div>)}
              {isResizeMode && (<Button variant="destructive" size="icon" className="dash-remove pointer-events-auto absolute -top-2 -right-2 z-30 h-6 w-6 rounded-full shadow-lg border-2 border-background" onClick={(e) => { e.stopPropagation(); onWidgetRemove(key); }} aria-label={`Remove ${key} widget`}><X className="h-3 w-3" /></Button>)}
              {isResizeMode && (<div className="dash-drag-handle" role="button" aria-label="Drag widget" tabIndex={0}><GripVertical className="h-4 w-4 text-muted-foreground" /></div>)}
              <div className={isResizeMode ? "dash-content dash-content--locked" : "dash-content"}>{renderWidget(key)}</div>
            </div>
          );
        })}
      </GridLayout>
      <style>{`.dashboard-grid{width:100%;box-sizing:border-box;overflow:visible}.dashboard-grid .layout{width:100%!important}.dashboard-grid .react-grid-layout{min-height:200px;width:100%!important;overflow:visible}.dashboard-grid .react-grid-item{max-width:100%;overflow:visible}.dash-item{height:100%;position:relative;overflow:visible;border-radius:.5rem;background:hsl(var(--card));border:1px solid hsl(var(--border));box-shadow:0 1px 2px hsl(var(--foreground)/.04)}.dash-content{height:100%;width:100%;overflow:auto;border-radius:.5rem}.dash-content>*{width:100%;max-width:100%;height:100%}.dash-content--locked{pointer-events:none;user-select:none}.dash-item--pending-remove{opacity:.55;filter:grayscale(.15)}.dash-item--pending-remove::before{content:"";position:absolute;inset:0;background:hsl(var(--destructive)/.06);pointer-events:none}.dash-pending-badge{position:absolute;bottom:6px;left:6px;z-index:25;pointer-events:none;font-size:11px;line-height:1;padding:3px 6px;border-radius:9999px;border:1px solid hsl(var(--destructive)/.3);background:hsl(var(--background)/.85);color:hsl(var(--destructive));backdrop-filter:blur(8px)}.dash-item--edit{box-shadow:0 0 0 2px hsl(var(--primary)/.35),0 4px 12px hsl(var(--foreground)/.08);border:2px solid hsl(var(--primary)/.45)}.dash-drag-handle{position:absolute;top:6px;left:6px;z-20;cursor:grab;border-radius:4px;padding:3px;border:1px solid hsl(var(--border));background:hsl(var(--background)/.95);backdrop-filter:blur(8px);box-shadow:0 1px 4px hsl(var(--foreground)/.06)}.dash-drag-handle:active{cursor:grabbing}.dashboard-grid .react-resizable-handle{background-image:none;opacity:0;transition:opacity .15s ease}.dash-item--edit .react-resizable-handle{opacity:1}.dashboard-grid .react-resizable-handle::after{content:"";position:absolute;width:8px;height:8px;border-right:2px solid hsl(var(--primary));border-bottom:2px solid hsl(var(--primary));right:3px;bottom:3px;border-radius:2px}.dashboard-grid .react-grid-item.react-grid-placeholder{background:hsl(var(--primary)/.15);border:2px dashed hsl(var(--primary)/.4);border-radius:.5rem}.dashboard-grid .react-grid-item>.react-resizable-handle{z-index:15}`}</style>
    </div>
  );
};