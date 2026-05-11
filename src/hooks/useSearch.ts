// ---------------------------------------------------------------------------
// useSearch.ts
// Mapbox Geocoding API integration for address search.
// Returns suggestions as the user types, debounced.
//
// Augmented with two non-Mapbox overlays:
//
//   1. Hand-curated venue aliases (see services/venueAliases.ts) — Mapbox
//      doesn't index venue/business names, so "Brooklyn Mirage" / "Pacha
//      New York" etc. surface synthetic alias suggestions at the top.
//
//   2. House-number search fallback (see services/internalSearch.ts) —
//      Mapbox doesn't autocomplete bare house numbers, so a query like
//      "75" otherwise returns nothing. When the query is purely numeric
//      we hit our own /api/search endpoint in parallel with Mapbox and
//      merge the results.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SearchSuggestion } from '../types';
import { findVenueAlias } from '../services/venueAliases';
import {
  fetchHouseNumberSuggestions,
  isHouseNumberQuery,
} from '../services/internalSearch';

const GEOCODING_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const DEBOUNCE_MS = 300;

interface UseSearchResult {
  query: string;
  setQuery: (q: string) => void;
  suggestions: SearchSuggestion[];
  clearSearch: () => void;
  loading: boolean;
}

export function useSearch(): UseSearchResult {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

  // Debounced fetch
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim() || !token) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);

      // Check the venue-alias table first. If the query matches a known
      // venue, surface a synthetic suggestion at the top of the dropdown
      // so the user gets the right parcel even before Mapbox has had a
      // chance to mismatch it. We still run the Mapbox query in parallel
      // so addresses on the same street as the venue still surface below.
      const alias = findVenueAlias(query);
      const aliasSuggestion: SearchSuggestion | null = alias
        ? {
            id: `alias:${alias.bbl}`,
            placeName: `${alias.displayAddress}, ${alias.borough}, NY ${alias.zipCode}`,
            text: alias.name,
            center: alias.center,
          }
        : null;

      // Fire Mapbox and (if applicable) the house-number fallback in
      // parallel — both go through the same debounce gate already, and we
      // want the dropdown to populate in one render rather than two.
      const encoded = encodeURIComponent(query.trim());
      const mapboxUrl =
        `${GEOCODING_BASE}/${encoded}.json?access_token=${token}` +
        `&country=US&bbox=-74.26,40.49,-73.70,40.92&types=address&limit=5`;

      const mapboxPromise = fetch(mapboxUrl)
        .then(async (res): Promise<SearchSuggestion[]> => {
          if (!res.ok) return [];
          const data = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (data.features ?? []).map((f: any) => ({
            id: f.id as string,
            placeName: f.place_name as string,
            text: f.text as string,
            center: f.center as [number, number],
          }));
        })
        .catch(() => [] as SearchSuggestion[]);

      const houseNoPromise = isHouseNumberQuery(query)
        ? fetchHouseNumberSuggestions(query)
        : Promise.resolve([] as SearchSuggestion[]);

      try {
        const [mapboxResults, houseNoResults] = await Promise.all([
          mapboxPromise,
          houseNoPromise,
        ]);

        // Order: venue alias (most specific intent) → house-number matches
        // from our DB (handles the bare-number case Mapbox can't) → Mapbox
        // address autocomplete. Cap at a reasonable visible length so the
        // dropdown doesn't stretch off-screen.
        const merged: SearchSuggestion[] = [];
        if (aliasSuggestion) merged.push(aliasSuggestion);
        merged.push(...houseNoResults);
        merged.push(...mapboxResults);

        // Deduplicate by id (e.g., a Mapbox result and a DB result for the
        // same address shouldn't both appear). DB results come first so
        // they win the dedupe race when both are present.
        const seenIds = new Set<string>();
        const deduped = merged.filter((s) => {
          if (seenIds.has(s.id)) return false;
          seenIds.add(s.id);
          return true;
        });

        setSuggestions(deduped.slice(0, 8));
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, token]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
  }, []);

  return { query, setQuery, suggestions, clearSearch, loading };
}
