import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  isToday
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "./utils";

export interface CalendarProps {
  mode?: "single";
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  className?: string;
  disabledDays?: (date: Date) => boolean;
}

export function Calendar({
  selected,
  onSelect,
  className,
  disabledDays,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className={cn("p-3 sm:p-4 bg-white dark:bg-zinc-950 rounded-xl w-full max-w-sm mx-auto", className)}>
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isOutsideMonth = !isSameMonth(day, monthStart);
          const isDisabled = disabledDays ? disabledDays(day) : false;
          const today = isToday(day);

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect?.(day)}
              className={cn(
                "h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                isOutsideMonth && "text-zinc-300 dark:text-zinc-700",
                !isOutsideMonth && !isSelected && "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900",
                isSelected && "bg-[#01ADFB] text-white shadow-lg shadow-[#01ADFB]/20",
                today && !isSelected && "text-[#01ADFB] border border-[#01ADFB]/30",
                isDisabled && "opacity-20 cursor-not-allowed hover:bg-transparent"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
