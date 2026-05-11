// ---------------------------------------------------------------------------
// parcelGrouping.ts
//
// Transforms raw NYC API permit rows into Parcel objects.
//
// Pipeline (from Build Data Schema):
//   1. Group all permit rows by BBL
//   2. Create one Parcel per BBL
//   3. Populate parcel-level fields using values from any permit row for
//      that BBL (they are identical across rows).
//   4. Attach Permit objects, splitting into activePermits / permitHistory
//   5. Derive latestPermitSummary from the active permit with the most
//      recent issuedDate (falling back to approvedDate).
// ---------------------------------------------------------------------------

import type { RawPermitRow, Permit, Parcel } from '../types';
import { isPermitActive } from './permitStatus';
import { findVenueAliasByBbl } from './venueAliases';

// ---- helpers ---------------------------------------------------------------

function toNumber(val: string | undefined): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function safeString(val: string | undefined): string {
  return val ?? '';
}

/**
 * Build a display address from house number + street name.
 */
function buildDisplayAddress(row: RawPermitRow): string {
  const house = safeString(row.house_no).trim();
  const street = safeString(row.street_name).trim();
  if (house && street) return `${house} ${street}`;
  if (street) return street;
  return house || 'Unknown address';
}

// ---- core ------------------------------------------------------------------

/**
 * Convert a raw API row into a Permit object.
 */
function toPermit(row: RawPermitRow): Permit {
  const active = isPermitActive(
    safeString(row.permit_status),
    row.expired_date,
  );

  return {
    workPermit: safeString(row.work_permit),
    trackingNumber: safeString(row.tracking_number),
    jobFilingNumber: safeString(row.job_filing_number),
    sequenceNumber: toNumber(row.sequence_number),
    permitStatus: safeString(row.permit_status),
    workPermitText: safeString(row.work_permit_type),
    filingReason: safeString(row.filing_reason),
    workType: safeString(row.work_type),
    workLocation: safeString(row.work_on_floor),
    jobDescription: safeString(row.job_description),
    estimatedJobCost: toNumber(row.estimated_job_cost),
    approvedDate: safeString(row.approved_date),
    issuedDate: safeString(row.issued_date),
    expiredDate: safeString(row.expired_date),
    isActive: active,
  };
}

/**
 * Pick the representative row for parcel-level fields.
 *
 * Strategy:
 *   1. Group rows by (house_no, street_name) and pick the plurality —
 *      i.e. the house_no/street pair that DOB has filed the most permits
 *      against at this BBL. Multi-door parcels (Brooklyn Mirage spans 140
 *      / 144 / 528 Meserole; Pacific Park spans 13 doors) reliably file
 *      the bulk of their permits at the primary address, so plurality
 *      converges on something a human would recognize.
 *   2. Within the plurality group, prefer a row with valid coordinates.
 *      DOB occasionally emits empty lat/lng for individual permits even
 *      when the BBL is geocoded; we pull coords from a sibling row.
 *
 * The previous picker — "first row with coords" — was arbitrary, since
 * the API returns rows in no particular order. That landed Brooklyn
 * Mirage on 144 Stewart instead of 140, Pacific Park on a Washington
 * Walk address instead of 104 Carlton, etc.
 */
function pickParcelRow(rows: RawPermitRow[]): RawPermitRow {
  if (rows.length === 0) {
    // Caller guards against this, but be defensive — TS would otherwise
    // make us assert non-null below.
    throw new Error('pickParcelRow called with empty rows array');
  }

  // 1. Tally house_no/street_name frequency.
  const tally = new Map<string, number>();
  for (const r of rows) {
    const key = `${safeString(r.house_no).trim()}\t${safeString(r.street_name).trim()}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  // Sorted descending by count. Tie-break alphabetically on the key so
  // the result is stable across runs for parcels where two sub-addresses
  // happen to file the same number of permits.
  const ranked = [...tally.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const [pluralityKey] = ranked[0];

  // 2. Rows that match the plurality address. Prefer one with valid
  //    coords; fall back to the first match.
  const plurality = rows.filter((r) => {
    const key = `${safeString(r.house_no).trim()}\t${safeString(r.street_name).trim()}`;
    return key === pluralityKey;
  });

  const withCoords = plurality.find(
    (r) =>
      r.latitude && r.longitude && r.latitude !== '0' && r.longitude !== '0',
  );
  return withCoords ?? plurality[0];
}

/**
 * Derive latestPermitSummary from the active permit with the most recent
 * issuedDate, falling back to approvedDate.
 */
function deriveLatestPermitSummary(activePermits: Permit[]): string | null {
  if (activePermits.length === 0) return null;

  const sorted = [...activePermits].sort((a, b) => {
    const dateA = a.issuedDate || a.approvedDate;
    const dateB = b.issuedDate || b.approvedDate;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const latest = sorted[0];
  return latest.workPermitText || latest.jobDescription || null;
}

// ---- public API ------------------------------------------------------------

/**
 * Group raw permit rows by BBL and produce Parcel objects.
 */
export function groupRowsIntoParcels(rows: RawPermitRow[]): Parcel[] {
  // Step 1 — group by BBL
  const groups = new Map<string, RawPermitRow[]>();

  for (const row of rows) {
    const bbl = safeString(row.bbl);
    if (!bbl) continue; // skip rows without a BBL

    const existing = groups.get(bbl);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(bbl, [row]);
    }
  }

  // Step 2 — build Parcel objects
  const parcels: Parcel[] = [];

  for (const [bbl, groupRows] of groups) {
    const representative = pickParcelRow(groupRows);

    const permits = groupRows.map(toPermit);
    const active = permits.filter((p) => p.isActive);
    const history = permits.filter((p) => !p.isActive);

    const lat = toNumber(representative.latitude);
    const lng = toNumber(representative.longitude);

    // Collect every distinct sub-address seen at this BBL. Parcels can have
    // multiple — Brooklyn Mirage's BBL spans three doors. Search matching
    // uses this set so a search for "140 Stewart" still hits the parcel
    // whose representative row happens to be "144 Stewart" or "528 Meserole".
    const subAddrs = new Set<string>();
    for (const r of groupRows) {
      const addr = buildDisplayAddress(r);
      if (addr && addr !== 'Unknown address') subAddrs.add(addr);
    }

    // Alias-aware displayAddress: for BBLs in the curated venue-alias
    // table (Brooklyn Mirage, Pacific Park, Chinatown jail) the hand-
    // picked address from the alias entry takes precedence over whatever
    // plurality picked. This guarantees those launch-arc parcels surface
    // the address the user expects regardless of what DOB filed.
    const alias = findVenueAliasByBbl(bbl);
    const displayAddress = alias
      ? alias.displayAddress
      : buildDisplayAddress(representative);

    parcels.push({
      parcelId: bbl, // BBL is the unique parcel identifier
      bbl,
      bin: safeString(representative.bin),
      displayAddress,
      borough: safeString(representative.borough),
      nta: safeString(representative.nta),
      censusTract: safeString(representative.census_tract),
      communityBoard: safeString(representative.community_board),
      councilDistrict: safeString(representative.council_district),
      latitude: lat,
      longitude: lng,
      hasActivePermit: active.length > 0,
      activePermits: active,
      permitHistory: history,
      latestPermitSummary: deriveLatestPermitSummary(active),
      subAddresses: [...subAddrs],
    });
  }

  return parcels;
}
