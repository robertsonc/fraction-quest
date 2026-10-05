/** Hash router. Routes: #/profiles, #/map, #/skill/:id, #/lesson/:id, #/practice/:id, #/review/:id, #/coach */
export type Route =
  | { name: 'profiles' }
  | { name: 'map' }
  | { name: 'skill'; skillId: string }
  | { name: 'lesson'; skillId: string }
  | { name: 'practice'; skillId: string }
  | { name: 'review'; skillId: string }
  | { name: 'coach' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b] = parts;
  switch (a) {
    case 'map': return { name: 'map' };
    case 'coach': return { name: 'coach' };
    case 'skill': if (b) return { name: 'skill', skillId: b }; break;
    case 'lesson': if (b) return { name: 'lesson', skillId: b }; break;
    case 'practice': if (b) return { name: 'practice', skillId: b }; break;
    case 'review': if (b) return { name: 'review', skillId: b }; break;
    default: break;
  }
  return { name: 'profiles' };
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case 'profiles': return '#/profiles';
    case 'map': return '#/map';
    case 'coach': return '#/coach';
    default: return `#/${r.name}/${encodeURIComponent(r.skillId)}`;
  }
}

export function navigate(r: Route): void {
  const href = hrefOf(r);
  if (location.hash === href) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = href;
}
