"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileUp, RotateCcw, Download, FileText, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface FileManagementProps {
  label: string;
  path?: string | null;
  onUpload: (file: File) => Promise<void>;
  icon: React.ElementType;
  iconColor?: string;
  isUploading?: boolean;
}

export function FileManagement({
  label,
  path,
  onUpload,
  icon: Icon,
  iconColor = "text-zinc-500",
  isUploading = false,
}: FileManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file);
    if (e.target) e.target.value = "";
    setIsOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
        className="flex items-center gap-3 py-2.5 text-[11px] font-bold cursor-pointer text-zinc-600 dark:text-zinc-400"
      >
        <Icon className={cn("h-4 w-4", iconColor)} /> 
        {path ? `GESTIONAR ${label.toUpperCase()}` : `SUBIR ${label.toUpperCase()}`}
      </DropdownMenuItem>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {path ? `GESTIÓN DE ${label.toUpperCase()}` : `SUBIR ${label.toUpperCase()}`}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              {path ? `Visualice o actualice el documento ${label.toLowerCase()}.` : `Seleccione un archivo para cargar como ${label.toLowerCase()}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {path ? (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex justify-center p-2 min-h-[300px] items-center group relative">
                  {path.toLowerCase().includes('.pdf') ? (
                    <div className="flex flex-col items-center gap-4 text-zinc-400">
                      <FileText className="h-16 w-16 text-orange-500" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Documento PDF</p>
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={path}
                      alt={label}
                      className="max-w-full h-auto max-h-[400px] object-contain rounded-lg shadow-sm"
                    />
                  )}
                  
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(path, "_blank")}
                      className="bg-white border-white text-zinc-900 hover:bg-zinc-100 gap-2 font-black text-[10px] uppercase tracking-widest h-10"
                    >
                      <ExternalLink className="h-4 w-4" /> Ver Pantalla Completa
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <FileUp className="h-8 w-8 text-zinc-400" />
                </div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Sin archivo</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">No se ha cargado una {label.toLowerCase()} aún.</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full sm:w-auto font-black text-[10px] uppercase tracking-wider h-11 px-8 rounded-xl border-zinc-200 dark:border-zinc-800"
            >
              Cerrar
            </Button>
            
            <div className="flex w-full sm:w-auto gap-3">
              {path && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none gap-2 font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50"
                  onClick={() => window.open(path, "_blank")}
                >
                  <Download className="h-4 w-4" /> Original
                </Button>
              )}
              
              <Button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex-1 sm:flex-none gap-3 font-black text-[10px] uppercase tracking-widest h-11 px-8 rounded-xl shadow-lg transition-all",
                  path 
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" 
                    : "bg-azul-1 text-white shadow-azul-1/20"
                )}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Subiendo...
                  </>
                ) : path ? (
                  <>
                    <RotateCcw className="h-4 w-4" /> Actualizar {label}
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" /> Cargar {label}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="application/pdf,image/*"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
