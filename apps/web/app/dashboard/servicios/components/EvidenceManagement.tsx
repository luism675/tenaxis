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
import { Camera, FileUp, Loader2, ImageIcon, Eye, Plus } from "lucide-react";

interface Evidence {
  id: string;
  path: string;
}

interface EvidenceManagementProps {
  id: string;
  evidenciaPath?: string | null;
  evidencias?: Evidence[];
  onUpload: (files: FileList) => Promise<void>;
  isUploading?: boolean;
  // Opcional: onRemove?: (evidenceId: string) => Promise<void>;
}

export function EvidenceManagement({
  id: _id,
  evidenciaPath,
  evidencias = [],
  onUpload,
  isUploading = false,
}: EvidenceManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasEvidence = evidenciaPath || evidencias.length > 0;
  const totalCount = (evidenciaPath ? 1 : 0) + evidencias.length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await onUpload(files);
    if (e.target) e.target.value = "";
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
        <ImageIcon className="h-4 w-4 text-pink-500" /> 
        {hasEvidence ? `GESTIONAR EVIDENCIAS (${totalCount})` : "SUBIR EVIDENCIAS"}
      </DropdownMenuItem>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Camera className="h-5 w-5 text-pink-500" /> 
              Gestión de Evidencias Fotográficas
            </DialogTitle>
            <DialogDescription className="text-xs font-medium">
              Visualice las fotos del servicio o añada nuevas evidencias del trabajo realizado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-6">
            {hasEvidence ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {evidenciaPath && (
                  <div className="group relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={evidenciaPath} alt="Evidencia principal" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.open(evidenciaPath, "_blank")}
                        className="h-8 text-[9px] font-black uppercase tracking-widest bg-white text-zinc-900 border-white hover:bg-zinc-100"
                      >
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                      <span className="text-[8px] font-black text-white uppercase bg-black/50 px-2 py-0.5 rounded-full">Principal</span>
                    </div>
                  </div>
                )}
                
                {evidencias.map((ev, idx) => (
                  <div key={ev.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ev.path} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.open(ev.path, "_blank")}
                        className="h-8 text-[9px] font-black uppercase tracking-widest bg-white text-zinc-900 border-white hover:bg-zinc-100"
                      >
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-azul-1"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Añadir más</span>
                </button>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="h-20 w-20 rounded-[2rem] bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center mb-6 text-pink-500">
                  <ImageIcon className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">Sin evidencias</h3>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-2 max-w-[240px] text-center leading-relaxed">
                  No se han cargado fotos para este servicio. El técnico puede subirlas desde la App.
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-8 bg-azul-1 text-white h-12 px-10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-azul-1/20"
                >
                  Subir primeras fotos
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full sm:w-auto font-black text-[10px] uppercase tracking-wider h-11 px-8 rounded-xl border-zinc-200 dark:border-zinc-800"
            >
              Cerrar
            </Button>
            
            <Button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto gap-3 bg-azul-1 text-white font-black text-[10px] uppercase tracking-widest h-11 px-10 rounded-xl shadow-lg shadow-azul-1/20 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Subiendo...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" /> Subir {hasEvidence ? "Nuevas Fotos" : "Fotos"}
                </>
              )}
            </Button>
          </DialogFooter>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
            multiple
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
