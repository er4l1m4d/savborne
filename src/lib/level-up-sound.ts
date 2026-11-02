/**
 * Savborne — level-up chiptune
 *
 * Four ascending square-wave notes, ~340 ms total. No asset files: a few
 * oscillators beat shipping an .mp3 and never 404 on a bad connection.
 *
 * The AudioContext is created lazily on the first call, because browsers block
 * one constructed before a user gesture. A blocked or unavailable context is
 * silent, never an error — a level-up that fails to beep must not break the
 * level-up.
 */

let context: AudioContext | null = null

/** `[523.25, 659.25, 783.99, 1046.5]` Hz — C5 E5 G5 C6. */
const NOTES = [523.25, 659.25, 783.99, 1046.5]
const NOTE_MS = 90
const OVERLAP_MS = 20
const GAIN = 0.06

export function playLevelUp(): void {
  try {
    const Ctor =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    if (!context) context = new Ctor()
    // Autoplay policy: a context created before a gesture starts suspended.
    if (context.state === 'suspended') void context.resume()

    const start = context.currentTime
    NOTES.forEach((frequency, i) => {
      const at = start + (i * (NOTE_MS - OVERLAP_MS)) / 1000
      const stop = at + NOTE_MS / 1000

      const osc = context!.createOscillator()
      const gain = context!.createGain()

      osc.type = 'square'
      osc.frequency.setValueAtTime(frequency, at)

      // Short attack/decay so the notes click rather than blare.
      const attack = 0.008
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.linearRampToValueAtTime(GAIN, at + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, stop)

      osc.connect(gain)
      gain.connect(context!.destination)
      osc.start(at)
      osc.stop(stop)
    })
  } catch {
    // Silence is an acceptable outcome here.
  }
}
