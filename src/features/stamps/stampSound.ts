type AudioContextConstructor = typeof AudioContext

interface AudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor
}

export function playStampTapSound(enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return
  const AudioCtor = window.AudioContext || (window as AudioWindow).webkitAudioContext
  if (!AudioCtor) return

  try {
    const context = new AudioCtor()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(150, now)
    oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.06)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.1)
    window.setTimeout(() => {
      context.close().catch(() => {
        // Ignore audio cleanup errors.
      })
    }, 160)
  } catch {
    // Audio feedback is optional.
  }
}
