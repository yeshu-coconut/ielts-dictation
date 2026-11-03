export type Word = {
  id: string
  word: string
  meaning: string
  alts: string[]
  audio: string
}

export type Entry = Word & {
  sectionId: string
}

export type Section = {
  id: string
  title: string
  hint: string
  words: Word[]
}

export type Chapter = {
  id: string
  index: string
  title: string
  subtitle: string
  sections: Section[]
}

export type Corpus = {
  voice: string
  note: string
  wordCount: number
  sectionCount: number
  chapters: Chapter[]
}

export type Settings = {
  batchSize: 10 | 20 | 30 | 50
  rate: number
  repeats: 1 | 2 | 3
  autoNext: boolean
  masteryStreak: 1 | 2 | 3
  dailyGoal: number
}

export type SectionStat = {
  attempts: number
  correct: number
  answered: string[]
  passes: number
  lastAt: string | null
}

export type Mistake = {
  wordId: string
  sectionId: string
  wrong: number
  streak: number
  updatedAt: string
}

export type SessionLog = {
  id: string
  at: string
  kind: 'section' | 'review'
  sectionId: string
  label: string
  total: number
  correct: number
}

export type ProgressState = {
  version: 1
  settings: Settings
  daily: { date: string; count: number }
  sections: Record<string, SectionStat>
  mistakes: Mistake[]
  sessions: SessionLog[]
  places: Record<string, number>
}

export type PracticeRequest = {
  kind: 'section' | 'review'
  title: string
  kicker: string
  placeKey: string
  entries: Entry[]
}
