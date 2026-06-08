"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";

export interface ClienteSolicitanteOption {
  id: string;
  label: string;
  description?: string;
}

interface ClienteSolicitanteComboboxProps {
  value: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (option: ClienteSolicitanteOption | null) => void;
  options: ClienteSolicitanteOption[];
  selectedOption?: ClienteSolicitanteOption | null;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  recentMessage?: string;
  error?: string | null;
  triggerClassName?: string;
  contentClassName?: string;
}

export function ClienteSolicitanteCombobox({
  value,
  searchValue,
  onSearchChange,
  onSelect,
  options,
  selectedOption,
  loading = false,
  disabled = false,
  placeholder = "Buscar por teléfono, documento o nombre...",
  emptyMessage = "No se encontraron clientes.",
  recentMessage = "Escribí para buscar o elegí entre los últimos clientes.",
  error,
  triggerClassName,
  contentClassName,
}: ClienteSolicitanteComboboxProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open]);

  const mergedOptions = useMemo(() => {
    if (!selectedOption || options.some((option) => option.id === selectedOption.id)) {
      return options;
    }

    return [selectedOption, ...options];
  }, [options, selectedOption]);

  const helperMessage = searchValue.trim() ? emptyMessage : recentMessage;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full min-w-0 justify-between overflow-hidden rounded-xl border-zinc-300 bg-zinc-50/30 px-4 text-sm font-normal text-left hover:bg-white hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/30",
            !value && "text-zinc-400",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedOption?.label || placeholder}
          </span>
          <span className="ml-3 flex shrink-0 items-center gap-2">
            {value ? (
              <span
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelect(null);
                  onSearchChange("");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-[var(--radix-popover-trigger-width)] p-0 overflow-hidden", contentClassName)}>
        <div className="border-b border-zinc-100 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <Input
              ref={inputRef}
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={placeholder}
              className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {error ? (
            <div className="px-3 py-6 text-sm text-red-500">{error}</div>
          ) : mergedOptions.length === 0 ? (
            <div className="px-3 py-6 text-sm text-zinc-500">{helperMessage}</div>
          ) : (
            mergedOptions.map((option) => {
              const isSelected = option.id === value;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "flex w-full min-w-0 items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900",
                    isSelected && "bg-[var(--color-claro-azul-4)]/10 text-[var(--color-azul-1)]",
                  )}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{option.label}</p>
                    {option.description ? (
                      <p className="mt-1 truncate text-xs text-zinc-500">{option.description}</p>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-azul-1)] text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
          Se muestran hasta 10 resultados por búsqueda.
        </div>
      </PopoverContent>
    </Popover>
  );
}
