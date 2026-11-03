import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { knownSectionIds, knownWordIds } from '../lib/catalog.ts'
import {
  STORAGE_KEY,
  defaultState,
  exportProgress,
  finishPass as applyFinish,
  importProgress,
  recordAnswer as applyAnswer,
} from '../lib/progress.ts'
import type { ProgressState, SessionLog, Settings } from '../types.ts'

type StudyValue = {
  state: ProgressState
  setSettings: (patch: Partial<Settings>) => void
  setPlace: (key: string, groupIndex: number) => void
  recordAnswer: (event: { wordId: string; sectionId: string; ok: boolean }) => void
  finishPass: (session: Omit<SessionLog, 'id'> & { id: string }) => void
  importJson: (raw: unknown) => string | null
  reset: () => void
  download: () => void
}

const StudyContext = createContext<StudyValue | null>(null)

function loadState(): ProgressState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (!text) return defaultState()
    const saved = JSON.parse(text) as unknown
    const wrapped =
      saved && typeof saved === 'object' && !('app' in (saved as Record<string, unknown>))
        ? { app: 'ielts-listening-dictation', ...(saved as object) }
        : saved
    const parsed = importProgress(wrapped, knownWordIds, knownSectionIds)
    if ('error' in parsed) return defaultState()
    return parsed.state
  } catch {
    return defaultState()
  }
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ app: 'ielts-listening-dictation', ...state }))
  }, [state])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const setPlace = useCallback((key: string, groupIndex: number) => {
    setState((current) => ({ ...current, places: { ...current.places, [key]: groupIndex } }))
  }, [])

  const recordAnswer = useCallback((event: { wordId: string; sectionId: string; ok: boolean }) => {
    setState((current) => applyAnswer(current, event))
  }, [])

  const finishPass = useCallback((session: Omit<SessionLog, 'id'> & { id: string }) => {
    setState((current) => applyFinish(current, session))
  }, [])

  const importJson = useCallback((raw: unknown) => {
    const parsed = importProgress(raw, knownWordIds, knownSectionIds)
    if ('error' in parsed) return parsed.error
    setState(parsed.state)
    return null
  }, [])

  const reset = useCallback(() => setState(defaultState()), [])

  const download = useCallback(() => {
    const payload = exportProgress(state)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ielts-dictation-${payload.daily.date}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [state])

  const value = useMemo(
    () => ({ state, setSettings, setPlace, recordAnswer, finishPass, importJson, reset, download }),
    [state, setSettings, setPlace, recordAnswer, finishPass, importJson, reset, download],
  )

  return <StudyContext value={value}>{children}</StudyContext>
}

export function useStudy(): StudyValue {
  const value = useContext(StudyContext)
  if (!value) throw new Error('useStudy must be used within StudyProvider')
  return value
}
