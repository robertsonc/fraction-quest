/**
 * Read-aloud with the Web Speech API. Off by default; the learner turns it on in settings.
 * Device voices only, no network. speak() resolves when the utterance ends so the guess timer can
 * start after the learner has heard the problem (DESIGN.md refinement R4).
 */
export class Speech {
  enabled = false;

  available(): boolean {
    return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  cancel(): void {
    if (this.available()) speechSynthesis.cancel();
  }

  speak(text: string): Promise<void> {
    if (!this.enabled || !this.available() || !text.trim()) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/(\d+)\/(\d+)/g, '$1 over $2'));
        u.rate = 0.95;
        u.lang = 'en-US';
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        u.onend = finish;
        u.onerror = finish;
        // Safety net: some engines never fire onend for cancelled utterances.
        setTimeout(finish, Math.min(20000, 400 + text.length * 90));
        speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }
}
