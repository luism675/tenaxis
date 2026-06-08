"use client";

import React from "react";
import { ArrowUp, ArrowDown, EyeOff, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WidgetConfiguratorProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide: () => void;
}

export function WidgetConfigurator({ onMoveUp, onMoveDown, onHide }: WidgetConfiguratorProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-3xl border-2 border-dashed border-[#01ADFB] transition-all">
      <div className="flex items-center gap-2 bg-card p-3 rounded-2xl shadow-2xl border border-border">
        <div className="p-2 text-muted-foreground cursor-grab">
          <GripVertical className="h-5 w-5" />
        </div>
        
        {onMoveUp && (
          <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl" onClick={onMoveUp}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
        
        {onMoveDown && (
          <Button variant="outline" size="sm" className="h-10 w-10 p-0 rounded-xl" onClick={onMoveDown}>
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
        
        <Button variant="destructive" size="sm" className="h-10 w-10 p-0 rounded-xl" onClick={onHide}>
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
