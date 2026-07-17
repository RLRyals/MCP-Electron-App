/**
 * DashboardWidgetSlot
 * Mounts one plugin-contributed dashboard widget class (loaded by
 * dashboardWidgetLoader.ts) into a container div, mirroring how ViewRouter
 * mounts a full View instance -- just scoped to a widget-sized slot instead
 * of the whole page.
 */

import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { DashboardWidgetClass } from '../../services/dashboardWidgetLoader.js';

export interface DashboardWidgetSlotProps {
  WidgetClass: DashboardWidgetClass;
  pluginId: string;
}

export const DashboardWidgetSlot: React.FC<DashboardWidgetSlotProps> = ({ WidgetClass, pluginId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const widget = new WidgetClass();
    let cancelled = false;
    widget.mount(container).catch((error) => {
      if (!cancelled) {
        console.error(`[DashboardWidgetSlot] Failed to mount widget from plugin ${pluginId}:`, error);
      }
    });

    return () => {
      cancelled = true;
      widget.unmount?.();
    };
  }, [WidgetClass, pluginId]);

  return <div ref={containerRef} className="dashboard-widget-slot" data-plugin-id={pluginId} />;
};

export default DashboardWidgetSlot;
