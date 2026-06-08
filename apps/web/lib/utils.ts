import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStorageUrl(bucket: string, path: string) {
  if (!path) return "";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://axistestst.supabase.co";
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
