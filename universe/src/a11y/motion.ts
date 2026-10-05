/** Reduced motion honors the OS setting or the per-profile override (DESIGN.md 7.4). */
export function reducedMotion(): boolean {
  if (document.documentElement.dataset['motion'] === 'reduce') return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** Runs a WAAPI animation or, with reduced motion, jumps to the end state. Resolves when finished. */
export async function animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  try {
    const a = el.animate(keyframes, { fill: 'both', ...options });
    await a.finished;
    a.commitStyles?.();
    a.cancel();
  } catch {
    /* an element removed mid-animation is fine */
  }
}
