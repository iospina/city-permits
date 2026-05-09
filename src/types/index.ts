// ---------------------------------------------------------------------------
// Permit — used by the UI
// Matches the Build Data Schema exactly.
// ---------------------------------------------------------------------------
export interface Permit {
  /** DOB's per-permit identifier (e.g. "B01365390-S1-ST"). Useful for
   *  cross-referencing in DOB NOW directly. */
  workPermit: string;
  trackingNumber: string;
  jobFilingNumber: string;
  sequenceNumber: number;
  permitStatus: string;
  workPermitText: string;
  filingReason: string;
  workType: string;
  workLocation: string;
  jobDescription: string;
  estimatedJobCost: number;
  approvedDate: string;
  issuedDate: string;
  expiredDate: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Parcel — used by the UI
// Matches the Build Data Schema exactly.
// ---------------------------------------------------------------------------
export interface Parcel {
  parcelId: string;
  bbl: string;
  /** Building Identification Number — DOB's per-building ID. Distinct
   *  from BBL, which is per-tax-lot. */
  bin: string;
  displayAddress: string;
  borough: string;
  nta: string;
  censusTract: string;
  communityBoard: string;
  councilDistrict: string;
  latitude: number;
  longitude: number;
  hasActivePermit: boolean;
  activePermits: Permit[];
  permitHistory: Permit[];
  latestPermitSummary: string | null;
  /**
   * All unique "house_no street_name" combinations seen across permit rows
   * for this BBL. A single parcel can span multiple sub-addresses
   * (e.g. BBL 3029770001 = 140 STEWART AVENUE, 144 STEWART AVENUE, and
   * 528 MESEROLE STREET — three doors of the Brooklyn Mirage block).
   * Used by search matching to compare against any sub-address, not just
   * the representative `displayAddress`.
   */
  subAddresses: string[];
}

// ---------------------------------------------------------------------------
// RawPermitRow — shape of the rows returned by the NYC Open Data API
// (dataset rbx6-tga4).  Field names use the API's snake_case convention.
// ---------------------------------------------------------------------------
export interface RawPermitRow {
  borough: string;
  community_board: string;
  council_district: string;
  census_tract: string;
  nta: string;
  bin: string;
  bbl: string;
  house_no: string;
  street_name: string;
  job_filing_number: string;
  job_doc_number: string;
  tracking_number: string;
  sequence_number: string;
  work_permit_type: string;
  permit_status: string;
  filing_reason: string;
  work_type: string;
  work_on_floor: string;
  job_description: string;
  estimated_job_cost: string;
  approved_date: string;
  issued_date: string;
  expired_date: string;
  latitude: string;
  longitude: string;
  // Additional fields may exist; we only declare the ones we use.
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Search suggestion from Mapbox Geocoding API
// ---------------------------------------------------------------------------
export interface SearchSuggestion {
  id: string;
  placeName: string;
  text: string;
  center: [number, number]; // [lng, lat]
}
