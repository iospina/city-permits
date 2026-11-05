// ---------------------------------------------------------------------------
// promptGate.ts
// Keeps the parcel sheet to one ask per visit.
//
//   - The email alerts prompt (after Save) always wins and marks the visit.
//   - The research invite (after the first "Expand Details") shows only if no
//     prompt has appeared this visit, only once per device after an answer,
//     and never on Ignacio's own devices (?internal=1).
// ---------------------------------------------------------------------------

import { isInternalDevice } from './internalOptOut';

const SESSION_KEY = 'cp_prompt_shown_this_visit';
const INVITE_DONE_KEY = 'cp_research_invite_done';

export const RESEARCH_FORM_URL = 'https://tally.so/r/2jBP1j';

export function markPromptShownThisVisit(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Storage blocked: worst case a second ask appears in the same visit.
  }
}

function promptShownThisVisit(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markResearchInviteDone(): void {
  try {
    localStorage.setItem(INVITE_DONE_KEY, '1');
  } catch {
    // Storage blocked: the invite may show again on a later visit.
  }
}

export function canShowResearchInvite(): boolean {
  if (isInternalDevice()) return false;
  if (promptShownThisVisit()) return false;
  try {
    return localStorage.getItem(INVITE_DONE_KEY) !== '1';
  } catch {
    return true;
  }
}
