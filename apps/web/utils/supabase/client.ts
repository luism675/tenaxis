import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a dummy client or throw a more helpful error that doesn't break the build if possible
    // For now, we'll just return what createBrowserClient would, but we've identified the issue
    return createBrowserClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder'
    )
  }

  return createBrowserClient(url, key)
}
