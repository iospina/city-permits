// ---------------------------------------------------------------------------
// GET /api/search
// House-number search fallback. Mapbox's geocoder doesn't autocomplete bare
// house numbers (typing "75" alone returns zero suggestions), so we query
// our own permits table for parcels whose house_no starts with the query.
//
// Query params:
//   q  — REQUIRED. A 1-6 digit numeric string. Anything else returns 400.
//
// Response: an array of suggestion-shaped objects compatible with the client's
// SearchSuggestion type. Each suggestion's id is `alias:{bbl}` so the
// existing alias-path resolution in App.tsx handles it without modification.
// ---------------------------------------------------------------------------

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';

const HOUSE_NO_REGEX = /^\d{1,6}$/;
const MAX_RESULTS = 8;

interface Suggestion {
  id: string;
  placeName: string;
  text: string;
  center: [number, number];
}

interface PermitRow {
  bbl: string;
  house_no: string;
  street_name: string;
  borough: string;
  latitude: string;
  longitude: string;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const q = String(req.query.q ?? '').trim();
  if (!HOUSE_NO_REGEX.test(q)) {
    return res.status(400).json({
      error: 'q must be a 1–6 digit numeric house number',
    });
  }

  try {
    // Get up to 20 candidate rows. Exact-house-number matches surface first,
    // then shorter prefix matches (so "75" prefers "75" over "750"), then
    // alphabetic by street. We dedupe by BBL in JS afterwards — a single
    // BBL can carry many permit rows, but the UI wants one suggestion each.
    const prefix = `${q}%`;
    const rows = (await sql`
      SELECT bbl, house_no, street_name, borough, latitude, longitude
      FROM permits
      WHERE house_no LIKE ${prefix}
        AND latitude  ~ '^-?[0-9]+(\.[0-9]+)?$'
        AND longitude ~ '^-?[0-9]+(\.[0-9]+)?$'
      ORDER BY
        (house_no = ${q}) DESC,
        char_length(house_no),
        house_no,
        street_name
      LIMIT 20
    `) as unknown as PermitRow[];

    const seenBbls = new Set<string>();
    const results: Suggestion[] = [];
    for (const r of rows) {
      if (!r.bbl || seenBbls.has(r.bbl)) continue;
      seenBbls.add(r.bbl);

      const houseNo = r.house_no || '';
      const street = toTitleCase(r.street_name || '');
      const borough = toTitleCase(r.borough || '');
      const text = `${houseNo} ${street}`.trim();
      const placeName = borough ? `${text}, ${borough}` : text;

      results.push({
        id: `alias:${r.bbl}`,
        placeName,
        text,
        center: [Number(r.longitude), Number(r.latitude)],
      });

      if (results.length >= MAX_RESULTS) break;
    }

    res.setHeader(
      'Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=86400',
    );
    return res.status(200).json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/search] failed:', message);
    return res.status(500).json({ error: message });
  }
}
