"use client";

import React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";

import { AuditFilterOption } from "../types";

interface AuditFilterMultiSelectProps {
  label: string;
  placeholder: string;
  options: AuditFilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyMessage?: string;
}

export function AuditFilterMultiSelect({
  label,
  placeholder,
  options,
  values,
  onChange,
  emptyMessage = "No hay opciones disponibles.",
}: AuditFilterMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedMap = React.useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options],
  );

  const filteredOptions = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((entry) => entry !== value));
      return;
    }

    onChange([...values, value]);
  };

  const selectedLabels = values
    .map((value) => selectedMap.get(value) || value)
    .filter((label): label is string => !!label);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-14 w-full justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm hover:bg-accent/5",
              open && "border-accent/40 bg-accent/5",
            )}
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-bold",
                  values.length === 0 ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {values.length === 0
                  ? placeholder
                  : values.length === 1
                    ? selectedLabels[0]
                    : `${values.length} seleccionados`}
              </p>

              {values.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedLabels.slice(0, 2).map((selectedLabel) => (
                    <Badge
                      key={selectedLabel}
                      variant="secondary"
                      className="max-w-full truncate rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                    >
                      {selectedLabel}
                    </Badge>
                  ))}

                  {selectedLabels.length > 2 && (
                    <Badge
                      variant="outline"
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                    >
                      +{selectedLabels.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] space-y-3 p-0">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground">
                  {label}
                </p>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  Seleccioná una o varias opciones.
                </p>
              </div>

              {values.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-[10px] font-black uppercase tracking-[0.18em]"
                  onClick={() => onChange([])}
                >
                  Limpiar
                </Button>
              )}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                className="h-11 rounded-xl border border-border bg-background pl-10 pr-10 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Limpiar búsqueda de ${label.toLowerCase()}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto px-2 pb-2">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm font-medium text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const selected = values.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-accent/10 text-accent"
                        : "text-foreground hover:bg-muted/70",
                    )}
                    onClick={() => toggleValue(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {option.label}
                    </span>

                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-accent bg-accent text-white"
                          : "border-border bg-background text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
