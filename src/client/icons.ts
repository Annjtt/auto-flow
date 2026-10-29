/**
 * Trait icon set for races and classes.
 * Small stroke glyphs that inherit `currentColor`, so they tint with every
 * race/class accent used across the shop, bench, synergies and tooltips.
 */

const ICONS: Record<string, string> = {
  human: `
    <path d="M12 2.8 19 6v6.1c0 4.2-3 7.6-7 9.1-4-1.5-7-4.9-7-9.1V6l7-3.2Z" />
    <path d="m8.8 11.5 2.2 2.2 4.3-4.5" />`,
  undead: `
    <path d="M12 3.1c-4 0-7 2.9-7 6.8 0 2.1.9 3.6 2.4 4.7V18h3.1v2.2h3v-2.2h3.1v-3.4c1.5-1.1 2.4-2.6 2.4-4.7 0-3.9-3-6.8-7-6.8Z" />
    <circle cx="9.3" cy="10.2" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="10.2" r="1.25" fill="currentColor" stroke="none" />
    <path d="m10.5 14.1 1.5 1.7 1.5-1.7" />`,
  mech: `
    <circle cx="12" cy="12" r="3.15" />
    <path d="M12 2.6v2.3M12 19.1v2.3M21.4 12h-2.3M4.9 12H2.6M18.65 5.35l-1.6 1.6M6.95 17.05l-1.6 1.6M18.65 18.65l-1.6-1.6M6.95 6.95l-1.6-1.6" />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />`,
  beast: `
    <circle cx="12" cy="15.1" r="3.3" />
    <circle cx="6.5" cy="9.1" r="1.5" />
    <circle cx="9.9" cy="6.5" r="1.5" />
    <circle cx="14.1" cy="6.5" r="1.5" />
    <circle cx="17.5" cy="9.1" r="1.5" />
    <path d="M9.6 15.4h4.8" />`,
  demon: `
    <path d="M4.9 8.4C4.1 5.8 5.4 3.4 7.9 2.8c.2 2 .8 3.4 2 4.5M19.1 8.4c.8-2.6-.5-5-3-5.6-.2 2-.8 3.4-2 4.5" />
    <path d="M12 8.8c3.1 0 5.2 2.3 5.2 5.2S15.1 20.3 12 20.3s-5.2-3.4-5.2-6.3 2.1-5.2 5.2-5.2Z" />
    <path d="M9.6 13.2h.01M14.4 13.2h.01" stroke-width="2.6" />
    <path d="m10.3 16.7 1.7 1.3 1.7-1.3" />`,
  elf: `
    <path d="M19.6 4.4C11.8 4 6 8.4 6 14.9c0 1.6.5 3 1.4 4.1 5.2-.4 11.4-4 12.2-14.6Z" />
    <path d="M6.4 19.6c1.9-4.6 5-7.9 9.3-10.2" />`,
  warrior: `
    <path d="M6.9 4.6 4.4 20.4" />
    <path d="M7 4.6c4.1 0 6.8 2 7.9 5.3l-5.7 2.7L7 4.6Z" />
    <path d="M4.9 15.2h5.4" />`,
  mage: `
    <path d="M6.1 20.6 14.9 8.6" />
    <circle cx="16.4" cy="6.4" r="3.1" />
    <path d="M16.4 1.4v1.3M16.4 10.1v1.3M11.4 6.4h1.3M20.1 6.4h1.3M12.9 2.9l.9.9M18.9 8.9l.9.9M19.9 2.9l-.9.9M12.9 8.9l-.9.9" />`,
  hunter: `
    <path d="M4.6 4.4c7 0 15 8 15 15" />
    <path d="M19.9 19.7 4.8 4.6" />
    <path d="M4.6 4.4 5 8.9M4.6 4.4 9.1 4.8" />
    <path d="m15.8 15.6-2-2M18.2 18l-1.5 1.5M18 18.2l1.5-1.5" stroke-width="1.2" />`,
  assassin: `
    <path d="M12 2.7 15 9l-3 10.3L9 9l3-6.3Z" />
    <path d="M7.4 12.4h9.2M10.1 20.9h3.8" />`,
  rune: `
    <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" />
    <path d="M12 7.3 16.7 12 12 16.7 7.3 12 12 7.3Z" />`,
};

const RACE_KEYS = new Set(['human', 'undead', 'mech', 'beast', 'demon', 'elf']);
const CLASS_KEYS = new Set(['warrior', 'mage', 'hunter', 'assassin']);

export function traitIcon(key: string, extraClass = ''): string {
  const body = ICONS[key] ?? ICONS.rune;
  const kind = RACE_KEYS.has(key) ? 'race' : CLASS_KEYS.has(key) ? 'class' : 'trait';
  return `<svg class="trait-icon ${kind}-icon trait-${key} ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function traitLabel(key: string, name: string): string {
  return `<span class="trait-label">${traitIcon(key)}<span>${name}</span></span>`;
}
