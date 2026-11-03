import { useCallback, useEffect, useRef, useState } from 'react'

export type PlayStatus = 'idle' | 'loading' | 'playing' | 'blocked' | 'error'

export function usePronunciation() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)
  const unlockedRef = useRef(false)
  const [status, setStatus] = useState<PlayStatus>('idle')

  const stop = useCallback(() => {
    tokenRef.current += 1
    audioRef.current?.pause()
    setStatus('idle')
  }, [])

  const play = useCallback((src: string, rate: number, repeats: number) => {
    const token = ++tokenRef.current
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioRef.current?.pause()
    audioRef.current = audio
    setStatus('loading')
    let remaining = Math.max(1, repeats)

    const start = () => {
      audio.playbackRate = rate
      return audio.play()
    }

    audio.onplaying = () => {
      if (tokenRef.current !== token) return
      unlockedRef.current = true
      setStatus('playing')
    }
    audio.onended = () => {
      if (tokenRef.current !== token) return
      remaining -= 1
      if (remaining > 0) {
        window.setTimeout(() => {
          if (tokenRef.current !== token) return
          audio.currentTime = 0
          void start().catch(() => setStatus('error'))
        }, 320)
      } else {
        setStatus('idle')
      }
    }
    audio.onerror = () => {
      if (tokenRef.current === token) setStatus('error')
    }
    void start().catch((error: unknown) => {
      if (tokenRef.current !== token) return
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError' ? 'blocked' : 'error')
    })
  }, [])

  const setRate = useCallback((rate: number) => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [])

  useEffect(() => () => audioRef.current?.pause(), [])

  return { play, stop, setRate, status, unlockedRef }
}
