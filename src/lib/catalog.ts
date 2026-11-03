import type { Corpus, Entry, Section } from '../types.ts'
import raw from '../data/corpus.json' with { type: 'json' }

export const corpus = raw as Corpus

export type LocatedSection = Section & {
  chapterIndex: string
  chapterTitle: string
}

const located = new Map<string, LocatedSection>()
const entries = new Map<string, Entry>()

for (const chapter of corpus.chapters) {
  for (const section of chapter.sections) {
    located.set(section.id, {
      ...section,
      chapterIndex: chapter.index,
      chapterTitle: chapter.title,
    })
    for (const word of section.words) {
      entries.set(word.id, { ...word, sectionId: section.id })
    }
  }
}

export function getSection(id: string): LocatedSection | undefined {
  return located.get(id)
}

export function getEntry(id: string): Entry | undefined {
  return entries.get(id)
}

export function sectionEntries(section: Section): Entry[] {
  return section.words.map((word) => ({ ...word, sectionId: section.id }))
}

export const knownWordIds = new Set(entries.keys())
export const knownSectionIds = new Set(located.keys())

export function mistakeEntries(wordIds: string[]): Entry[] {
  return wordIds.flatMap((id) => {
    const entry = entries.get(id)
    return entry ? [entry] : []
  })
}
