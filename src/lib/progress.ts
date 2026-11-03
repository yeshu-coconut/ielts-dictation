import type { Mistake, ProgressState, SectionStat, SessionLog, Settings } from '../types.ts'
import { todayKey } from './utils.ts'

export const STORAGE_KEY = 'ielts-dictation-v1'
export const EXPORT_APP = 'ielts-listening-dictation'

export const BATCH_SIZES = [10, 20, 30, 50] as const
export const RATES = [0.8, 1, 1.15, 1.3, 1.5] as const
export const REPEATS = [1, 2, 3] as const
export const MASTERY = [1, 2, 3] as const

export const DEFAULT_SETTINGS: Settings = {
  batchSize: 20,
  rate: 1,
  repeats: 1,
  autoNext: true,
  masteryStreak: 2,
  dailyGoal: 40,
}

const emptyStat = (): SectionStat => ({
  attempts: 0,
  correct: 0,
  answered: [],
  passes: 0,
  lastAt: null,
})

export function defaultState(now = new Date()): ProgressState {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    daily: { date: todayKey(now), count: 0 },
    sections: {},
    mistakes: [],
    sessions: [],
    places: {},
  }
}

export function recordAnswer(
  state: ProgressState,
  event: { wordId: string; sectionId: string; ok: boolean; at?: Date },
): ProgressState {
  const at = event.at ?? new Date()
  const iso = at.toISOString()
  const date = todayKey(at)
  const daily = state.daily.date === date ? { date, count: state.daily.count + 1 } : { date, count: 1 }
  const prev = state.sections[event.sectionId] ?? emptyStat()
  const sections = {
    ...state.sections,
    [event.sectionId]: {
      attempts: prev.attempts + 1,
      correct: prev.correct + (event.ok ? 1 : 0),
      answered: prev.answered.includes(event.wordId) ? prev.answered : [...prev.answered, event.wordId],
      passes: prev.passes,
      lastAt: iso,
    },
  }

  let mistakes: Mistake[]
  const existing = state.mistakes.find((item) => item.wordId === event.wordId)
  if (event.ok) {
    if (!existing) {
      mistakes = state.mistakes
    } else {
      const streak = existing.streak + 1
      mistakes =
        streak >= state.settings.masteryStreak
          ? state.mistakes.filter((item) => item.wordId !== event.wordId)
          : state.mistakes.map((item) =>
              item.wordId === event.wordId ? { ...item, streak, updatedAt: iso } : item,
            )
    }
  } else if (existing) {
    mistakes = state.mistakes.map((item) =>
      item.wordId === event.wordId ? { ...item, wrong: item.wrong + 1, streak: 0, updatedAt: iso } : item,
    )
  } else {
    mistakes = [
      ...state.mistakes,
      { wordId: event.wordId, sectionId: event.sectionId, wrong: 1, streak: 0, updatedAt: iso },
    ]
  }

  return { ...state, daily, sections, mistakes }
}

export function finishPass(
  state: ProgressState,
  session: Omit<SessionLog, 'id'> & { id: string },
): ProgressState {
  if (state.sessions.some((item) => item.id === session.id)) return state
  const sections = { ...state.sections }
  if (session.kind === 'section') {
    const prev = sections[session.sectionId] ?? emptyStat()
    sections[session.sectionId] = { ...prev, passes: prev.passes + 1, lastAt: session.at }
  }
  return {
    ...state,
    sections,
    sessions: [session, ...state.sessions].slice(0, 80),
  }
}

function asSettings(value: unknown): Settings {
  const raw = value && typeof value === 'object' ? (value as Partial<Settings>) : {}
  const batchSize = BATCH_SIZES.includes(raw.batchSize as Settings['batchSize'])
    ? (raw.batchSize as Settings['batchSize'])
    : DEFAULT_SETTINGS.batchSize
  const rate = typeof raw.rate === 'number' && RATES.includes(raw.rate as (typeof RATES)[number])
    ? raw.rate
    : DEFAULT_SETTINGS.rate
  const repeats = REPEATS.includes(raw.repeats as Settings['repeats'])
    ? (raw.repeats as Settings['repeats'])
    : DEFAULT_SETTINGS.repeats
  const masteryStreak = MASTERY.includes(raw.masteryStreak as Settings['masteryStreak'])
    ? (raw.masteryStreak as Settings['masteryStreak'])
    : DEFAULT_SETTINGS.masteryStreak
  const dailyGoal =
    typeof raw.dailyGoal === 'number' && raw.dailyGoal >= 5 && raw.dailyGoal <= 500
      ? Math.round(raw.dailyGoal)
      : DEFAULT_SETTINGS.dailyGoal
  return {
    batchSize,
    rate,
    repeats,
    autoNext: typeof raw.autoNext === 'boolean' ? raw.autoNext : DEFAULT_SETTINGS.autoNext,
    masteryStreak,
    dailyGoal,
  }
}

export function exportProgress(state: ProgressState, now = new Date()) {
  return {
    app: EXPORT_APP,
    version: 1 as const,
    exportedAt: now.toISOString(),
    settings: state.settings,
    daily: state.daily,
    sections: state.sections,
    mistakes: state.mistakes,
    sessions: state.sessions,
    places: state.places,
  }
}

export function importProgress(
  raw: unknown,
  knownWords: ReadonlySet<string>,
  knownSections: ReadonlySet<string>,
): { state: ProgressState } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: '文件不是 JSON 对象。' }
  const data = raw as Record<string, unknown>
  if (data.app !== EXPORT_APP || data.version !== 1) {
    return { error: '这不是本应用导出的进度文件。' }
  }
  const base = defaultState()
  const settings = asSettings(data.settings)
  const dailyRaw = data.daily as { date?: unknown; count?: unknown } | undefined
  const daily =
    dailyRaw && typeof dailyRaw.date === 'string' && typeof dailyRaw.count === 'number'
      ? { date: dailyRaw.date, count: Math.max(0, Math.round(dailyRaw.count)) }
      : base.daily

  const sections: ProgressState['sections'] = {}
  if (data.sections && typeof data.sections === 'object') {
    for (const [sectionId, value] of Object.entries(data.sections as Record<string, unknown>)) {
      if (!knownSections.has(sectionId) || !value || typeof value !== 'object') continue
      const stat = value as Partial<SectionStat>
      const answered = Array.isArray(stat.answered)
        ? stat.answered.filter((id): id is string => typeof id === 'string' && knownWords.has(id))
        : []
      sections[sectionId] = {
        attempts: typeof stat.attempts === 'number' ? Math.max(0, Math.round(stat.attempts)) : 0,
        correct: typeof stat.correct === 'number' ? Math.max(0, Math.round(stat.correct)) : 0,
        answered,
        passes: typeof stat.passes === 'number' ? Math.max(0, Math.round(stat.passes)) : 0,
        lastAt: typeof stat.lastAt === 'string' ? stat.lastAt : null,
      }
    }
  }

  const mistakes: Mistake[] = []
  if (Array.isArray(data.mistakes)) {
    for (const item of data.mistakes) {
      if (!item || typeof item !== 'object') continue
      const mistake = item as Partial<Mistake>
      if (typeof mistake.wordId !== 'string' || !knownWords.has(mistake.wordId)) continue
      if (typeof mistake.sectionId !== 'string' || !knownSections.has(mistake.sectionId)) continue
      mistakes.push({
        wordId: mistake.wordId,
        sectionId: mistake.sectionId,
        wrong: typeof mistake.wrong === 'number' ? Math.max(1, Math.round(mistake.wrong)) : 1,
        streak: typeof mistake.streak === 'number' ? Math.max(0, Math.round(mistake.streak)) : 0,
        updatedAt: typeof mistake.updatedAt === 'string' ? mistake.updatedAt : new Date().toISOString(),
      })
    }
  }

  const sessions: SessionLog[] = []
  if (Array.isArray(data.sessions)) {
    for (const item of data.sessions) {
      if (!item || typeof item !== 'object') continue
      const session = item as Partial<SessionLog>
      if (typeof session.id !== 'string' || typeof session.label !== 'string') continue
      if (session.kind !== 'section' && session.kind !== 'review') continue
      if (typeof session.sectionId !== 'string' || typeof session.at !== 'string') continue
      sessions.push({
        id: session.id,
        at: session.at,
        kind: session.kind,
        sectionId: session.sectionId,
        label: session.label,
        total: typeof session.total === 'number' ? session.total : 0,
        correct: typeof session.correct === 'number' ? session.correct : 0,
      })
    }
  }

  const places: Record<string, number> = {}
  if (data.places && typeof data.places === 'object') {
    for (const [key, value] of Object.entries(data.places as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) places[key] = Math.max(0, Math.round(value))
    }
  }

  return {
    state: {
      version: 1,
      settings,
      daily,
      sections,
      mistakes,
      sessions: sessions.slice(0, 80),
      places,
    },
  }
}
