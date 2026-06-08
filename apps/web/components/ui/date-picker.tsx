"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface DatePickerProps {
  date?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  date,
  onChange,
  placeholder = "fecha",
  className,
  disabled = false,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start overflow-hidden whitespace-nowrap text-left border border-zinc-200 bg-zinc-50/30 rounded-xl px-4 py-3 h-11 transition-all focus-within:border-zinc-200 focus-within:bg-white dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:text-zinc-50 dark:focus-within:border-zinc-200 dark:focus-within:bg-zinc-900",
            "text-sm uppercase font-medium tracking-normal",
            "hover:bg-zinc-50/30 hover:translate-y-0 hover:shadow-none",
            date ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400",
            className
          )}
        >
          <CalendarIcon className="mr-3 h-4 w-4 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">
            {date ? format(date, "PPP", { locale: es }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange?.(d);
            // We can't easily close popover from here without more logic, 
            // but clicking outside works.
          }}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800/50"
        />
      </PopoverContent>
    </Popover>
  );
}
