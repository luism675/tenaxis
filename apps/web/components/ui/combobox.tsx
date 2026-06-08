import * as React from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { cn } from "./utils";

export interface ComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  hideSearch?: boolean;
  defaultVisibleLimit?: number;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  disabled,
  className,
  triggerClassName,
  contentClassName,
  hideSearch = false,
  defaultVisibleLimit,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    if (hideSearch) {
      return defaultVisibleLimit
        ? options.slice(0, defaultVisibleLimit)
        : options;
    }

    if (!search) {
      return defaultVisibleLimit
        ? options.slice(0, defaultVisibleLimit)
        : options;
    }

    const normalizedSearch = search.toLowerCase().trim();
    return options.filter((opt) =>
      `${opt.label} ${opt.searchText ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [options, search, hideSearch, defaultVisibleLimit]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={cn("relative w-full", className, open && "z-50")}
      ref={containerRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50/30 px-4 py-2 text-sm transition-all focus:outline-none focus:border-zinc-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900/30 dark:focus:border-zinc-300",
          open && "border-zinc-300 bg-white shadow-sm",
          triggerClassName,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate text-left", !selectedOption && "text-zinc-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl animate-in fade-in zoom-in-95 slide-in-from-top-2 dark:border-zinc-800 dark:bg-zinc-950",
            contentClassName,
          )}
        >
          {!hideSearch && (
            <div className="flex items-center border-b border-zinc-100 px-3 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
              <Search className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                className="flex h-11 w-full bg-transparent py-3 pl-2 text-sm outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Escribe para buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-zinc-400" />
                </button>
              )}
            </div>
          )}
          <div className="overflow-y-auto max-h-[220px] custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500 italic">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full min-w-0 items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900 group",
                    value === option.value &&
                      "bg-[var(--color-claro-azul-4)]/10 text-[var(--color-azul-1)] font-bold",
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="min-w-0 flex-1 truncate pr-4">{option.label}</span>
                  {value === option.value && (
                    <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-azul-1)] flex items-center justify-center shadow-sm">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
