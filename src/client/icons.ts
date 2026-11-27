/**
 * Trait icon set for races and classes.
 * Small stroke glyphs that inherit `currentColor`, so they tint with every
 * race/class accent used across the shop, bench, synergies and tooltips.
 *
 * Every glyph is drawn on a 24x24 grid with the same optical weight, keeps a
 * safe margin from the viewBox edge and is vertically balanced, so the icons
 * line up cleanly at sizes from 9px (unit cards) to 26px (synergy panel).
 */

const ICONS: Record<string, string> = {
  human: `
    <path d="M12 2.8 19.2 6v6.1c0 4.3-3.1 7.7-7.2 9.2-4.1-1.5-7.2-4.9-7.2-9.2V6L12 2.8Z" />
    <path d="M12 8.5v6.6M8.7 11.8h6.6" />`,
  undead: `
    <path d="M12 3.1c-3.9 0-7 2.9-7 6.6 0 2.1.9 3.8 2.5 4.9v2.1c0 .8.6 1.4 1.4 1.4h6.2c.8 0 1.4-.6 1.4-1.4v-2.1c1.6-1.1 2.5-2.8 2.5-4.9 0-3.7-3.1-6.6-7-6.6Z" />
    <circle cx="9.4" cy="10.1" r="1.35" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="10.1" r="1.35" fill="currentColor" stroke="none" />
    <path d="m12 11.7-.9 1.8h1.8L12 11.7Z" fill="currentColor" stroke="none" />
    <path d="M9.7 18.1v2.1M12 18.1v2.1M14.3 18.1v2.1" />`,
  mech: `
    <circle cx="12" cy="2.6" r="1.05" />
    <path d="M12 3.65v2.15" />
    <rect x="4.8" y="5.8" width="14.4" height="11.2" rx="2.8" />
    <circle cx="9.3" cy="10.7" r="1.35" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="10.7" r="1.35" fill="currentColor" stroke="none" />
    <path d="M9.2 14.2h5.6" />`,
  beast: `
    <path d="M12 20.8c-2.8 0-4.9-1.6-4.9-3.8 0-2 1.7-3.6 4.9-5.7 3.2 2.1 4.9 3.7 4.9 5.7 0 2.2-2.1 3.8-4.9 3.8Z" />
    <ellipse cx="6.7" cy="9.4" rx="1.5" ry="1.8" />
    <ellipse cx="9.9" cy="6.6" rx="1.5" ry="1.9" />
    <ellipse cx="14.1" cy="6.6" rx="1.5" ry="1.9" />
    <ellipse cx="17.3" cy="9.4" rx="1.5" ry="1.8" />`,
  demon: `
    <path d="M12 21.2V9.7" />
    <path d="M12 9.7V2.6" />
    <path d="M6.4 2.8v4.2c0 1.5 1.2 2.7 2.7 2.7H12" />
    <path d="M17.6 2.8v4.2c0 1.5-1.2 2.7-2.7 2.7H12" />`,
  elf: `
    <path d="M20.4 3.9C12.3 3.5 5.6 8.2 5.6 15c0 1.9.7 3.5 1.9 4.7 5.7-.3 12.1-4.4 12.9-15.8Z" />
    <path d="M6.2 20.1c1.7-5 5-8.7 9.5-11.1" />`,
  warrior: `
    <path d="M12 2.6 14.1 5.2v8.4H9.9V5.2L12 2.6Z" />
    <path d="M6.8 13.6h10.4" />
    <path d="M12 13.6v5.2" />
    <path d="M10 20.6h4" />`,
  mage: `
    <path d="M5.6 20.4 14.3 8.7" />
    <path d="M16.3 2.8c.3 2.2 1.5 3.4 3.7 3.7-2.2.3-3.4 1.5-3.7 3.7-.3-2.2-1.5-3.4-3.7-3.7 2.2-.3 3.4-1.5 3.7-3.7Z" />
    <path d="M20.4 12.3c.15 1.1.75 1.7 1.85 1.85-1.1.15-1.7.75-1.85 1.85-.15-1.1-.75-1.7-1.85-1.85 1.1-.15 1.7-.75 1.85-1.85Z" />`,
  hunter: `
    <path d="M8.8 3.4c3.8 2.4 5.8 5.1 5.8 8.6s-2 6.2-5.8 8.6" />
    <path d="M8.8 3.4v17.2" />
    <path d="M4.6 12h11.2" />
    <path d="m13.2 9.2 2.8 2.8-2.8 2.8" />
    <path d="M4.6 12 2.4 9.8M4.6 12l-2.2 2.2" />`,
  assassin: `
    <path d="M12 2.6c1.5 2.1 2.3 4.3 2.3 6.7 0 2-.8 3.7-2.3 4.8-1.5-1.1-2.3-2.8-2.3-4.8 0-2.4.8-4.6 2.3-6.7Z" />
    <path d="M7.6 13.8h8.8" />
    <path d="M12 13.8v5.4" />
    <path d="M10.1 20.8h3.8" />`,
  rune: `
    <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" />
    <path d="M12 7.4 16.6 12 12 16.6 7.4 12 12 7.4Z" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />`,
};

const RACE_KEYS = new Set(['human', 'undead', 'mech', 'beast', 'demon', 'elf']);
const CLASS_KEYS = new Set(['warrior', 'mage', 'hunter', 'assassin']);

export function traitIcon(key: string, extraClass = ''): string {
  const body = ICONS[key] ?? ICONS.rune;
  const kind = RACE_KEYS.has(key) ? 'race' : CLASS_KEYS.has(key) ? 'class' : 'trait';
  return `<svg class="trait-icon ${kind}-icon trait-${key} ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function traitLabel(key: string, name: string): string {
  return `<span class="trait-label">${traitIcon(key)}<span>${name}</span></span>`;
}
