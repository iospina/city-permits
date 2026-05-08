// ---------------------------------------------------------------------------
// dataService.ts
// Fetches permit rows from the CUC-owned API endpoint.
//
// History: pre-Brooklyn-Mirage-launch this file fetched directly from the
// NYC Open Data API (rbx6-tga4) from the browser, capped at 10 000 rows.
// The May 2026 audit revealed that cap was silently dropping ~90% of active
// permits citywide. The fix is structural: a server-side daily sync into a
// CUC-owned Postgres database, with the client reading from a CUC endpoint.
// See db/schema.sql, lib/sync.ts, and api/parcels.ts.
// ---------------------------------------------------------------------------

import type { RawPermitRow } from '../types';

const PARCELS_ENDPOINT = '/api/parcels';

/**
 * Fetch every active permit row from the CUC API.
 *
 * "Active" matches CUC's product definition exactly:
 *   permit_status = 'Permit Issued'
 *   AND (expired_date IS NULL OR expired_date > today)
 *
 * The server enforces this filter during the daily sync, so the client
 * receives only currently-active rows.
 */
export async function fetchPermitRows(): Promise<RawPermitRow[]> {
  const response = await fetch(PARCELS_ENDPOINT);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch permits: ${response.status} ${response.statusText}`,
    );
  }

  const data: RawPermitRow[] = await response.json();
  return data;
}
