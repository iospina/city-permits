// ---------------------------------------------------------------------------
// internalOptOut.ts
// Lets Ignacio exclude his own devices from analytics.
//
//   ?internal=1  turns tracking off on this device (remembered in localStorage)
//   ?internal=0  turns it back on
//
// The parameter is removed from the address bar afterwards so it never ends
// up in a shared link. Shared across City Explorer apps: keep the storage key
// identical in every app.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ce_internal_opt_out';

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): nothing to remember.
  }
}

function showNote(text: string): void {
  try {
    const el = document.createElement('div');
    el.textContent = text;
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(24px + env(safe-area-inset-bottom, 0px))',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:#202124',
      'color:#fff',
      'font:500 14px/1.4 Roboto,system-ui,sans-serif',
      'padding:10px 16px',
      'border-radius:10px',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)',
      'pointer-events:none',
    ].join(';');
    const mount = () => {
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 3000);
    };
    if (document.body) mount();
    else window.addEventListener('DOMContentLoaded', mount, { once: true });
  } catch {
    // Never let the note break the app.
  }
}

/**
 * Reads ?internal= from the URL, updates the remembered choice, and returns
 * true when analytics should stay off on this device.
 */
export function isInternalDevice(): boolean {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get('internal');
    if (value === '1' || value === '0') {
      writeFlag(value === '1');
      showNote(value === '1' ? 'Tracking off on this device' : 'Tracking back on for this device');
      url.searchParams.delete('internal');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // Malformed URL: fall through to the remembered choice.
  }
  return readFlag();
}
