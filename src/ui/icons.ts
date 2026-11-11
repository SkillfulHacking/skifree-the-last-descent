/** Small line icons for achievements (inline SVG, stroke = currentColor). Icon ids are stable data. */
const P: Record<string, string> = {
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  yeti: '<circle cx="12" cy="9" r="5"/><path d="M9 8h.01M15 8h.01"/><path d="M9.5 11.5 11 12.5l1-1 1 1 1.5-1"/><path d="M6 21c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5"/>',
  pizza: '<path d="M3 5c6-2.5 12-2.5 18 0L12 21Z"/><circle cx="10" cy="9" r="1.2"/><circle cx="14.5" cy="10.5" r="1.2"/><circle cx="12" cy="14" r="1"/>',
  jump: '<path d="M2 20h7l4-6"/><path d="M13 14c2-6 5-8 9-8"/><circle cx="18" cy="4" r="1.6"/>',
  mountain: '<path d="M2 20 9 7l4 6 2-3 7 10Z"/><path d="m7.5 10 1.5 1.5L10.5 10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
  snowball: '<circle cx="12" cy="12" r="7"/><path d="M8 10h.01M14 8h.01M15 14h.01M10 15h.01"/><path d="M3 4l3 3M21 4l-3 3"/>',
  claw: '<path d="M6 20c1-6 2-10 1-15"/><path d="M11 20c.5-6 1.5-10 1-15"/><path d="M16 20c0-6 1-10 2-14"/>',
  viewpoint: '<circle cx="7" cy="14" r="4"/><circle cx="17" cy="14" r="4"/><path d="M11 14h2M5 10l2-5h2M19 10l-2-5h-2"/>',
  storm: '<path d="M7 15a4 4 0 0 1 .5-8A6 6 0 0 1 19 9a3 3 0 0 1-1 6"/><path d="M8 19h7M5 22h9M10 17h9"/>',
  ice: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  steam: '<path d="M8 20c-2-3 2-5 0-8s2-5 0-8"/><path d="M13 20c-2-3 2-5 0-8s2-5 0-8"/><path d="M18 20c-2-3 2-5 0-8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  secret: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7"/><path d="M12 17h.01"/>',
  jacket: '<path d="M9 3 5 5 2 10l3 2v9h14v-9l3-2-3-5-4-2-3 3Z"/><path d="M12 6v15"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
};

export function icon(id: string, cls = 'ach-icon'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[id] ?? P['star']}</svg>`;
}
