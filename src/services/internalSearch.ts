// ---------------------------------------------------------------------------
// internalSearch.ts
// Client wrapper around /api/search, the house-number fallback endpoint.
//
// Why: Mapbox's geocoder won't autocomplete bare house numbers (typing
// "75" alone returns zero suggestions). The /api/search endpoint scans
// our own permits table for parcels with a matching house_no prefix,
// giving the user something to pick when Mapbox would otherwise leave
// them with an empty dropdown.
//
// Trigger conditions live in useSearch.ts — keep this module dumb: it
// just shapes a request, parses the response, and returns SearchSuggestion[].
// ---------------------------------------------------------------------------

import type { SearchSuggestion } from '../types';

/** Treat the query as a house-number lookup when it's purely 1–6 digits. */
export function isHouseNumberQuery(query: string): boolean {
  return /^\d{1,6}$/.test(query.trim());
}

/**
 * Fetch house-number suggestions from /api/search. Returns an empty array
 * on any failure — this is a fallback path and shouldn't bubble errors up
 * to the user. The caller should already have a separate primary path
 * (Mapbox) running in parallel.
 */
export async function fetchHouseNumberSuggestions(
  query: string,
): Promise<SearchSuggestion[]> {
  const q = query.trim();
  if (!isHouseNumberQuery(q)) return [];

  try {
    const url = `/api/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as SearchSuggestion[];
  } catch {
    return [];
  }
}
