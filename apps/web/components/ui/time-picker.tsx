"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface TimePickerProps {
  value?: string; // Format "HH:mm"
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function TimePicker({
  value = "12:00",
  onChange,
  className,
  disabled = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  const [selectedHour, selectedMinute] = value.split(":");

  const handleHourSelect = (h: string) => {
    onChange?.(`${h}:${selectedMinute || "00"}`);
  };

  const handleMinuteSelect = (m: string) => {
    onChange?.(`${selectedHour || "12"}:${m}`);
  };

  // Format for display (AM/PM)
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "Seleccionar hora";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h || "0");
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start overflow-hidden whitespace-nowrap text-left border border-zinc-200 bg-zinc-50/30 rounded-xl px-4 py-3 h-11 transition-all focus-within:border-zinc-200 focus-within:bg-white dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:text-zinc-50 dark:focus-within:border-zinc-200 dark:focus-within:bg-zinc-900",
            "normal-case tracking-normal text-[11px] font-medium",
            value ? "text-zinc-900 dark:text-zinc-50 font-bold" : "text-zinc-400",
            className
          )}
        >
          <Clock className="mr-3 h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">
            {value ? formatTime(value) : "Seleccionar hora"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
        <div className="flex h-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/50">
          {/* Hours Column */}
          <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-zinc-50 dark:border-zinc-900 py-2">
            <div className="px-3 py-1 mb-1 text-[9px] font-black uppercase text-zinc-400 sticky top-0 bg-white dark:bg-zinc-950 z-10">Hora</div>
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleHourSelect(h)}
                className={cn(
                  "w-full px-3 py-2 text-xs font-bold text-left transition-colors",
                  selectedHour === h 
                    ? "bg-azul-1 text-white" 
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                )}
              >
                {h}
              </button>
            ))}
          </div>
          {/* Minutes Column */}
          <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
            <div className="px-3 py-1 mb-1 text-[9px] font-black uppercase text-zinc-400 sticky top-0 bg-white dark:bg-zinc-950 z-10">Min</div>
            {minutes.filter(m => parseInt(m) % 5 === 0).map((m) => ( // Step 5 for better UX
              <button
                key={m}
                type="button"
                onClick={() => {
                  handleMinuteSelect(m);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-xs font-bold text-left transition-colors",
                  selectedMinute === m 
                    ? "bg-azul-1 text-white" 
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
