import { useMemo, useState } from 'react'
import { corpus, getEntry, getSection, mistakeEntries } from '../lib/catalog.ts'
import { useStudy } from '../context/StudyContext.tsx'
import type { PracticeRequest } from '../types.ts'
import { Button } from './ui/button.tsx'

export function MistakesView({ onStart }: { onStart: (request: PracticeRequest) => void }) {
  const { state } = useStudy()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const visible = useMemo(() => {
    return state.mistakes
      .filter((mistake) => filter === 'all' || mistake.sectionId === filter)
      .map((mistake) => ({ mistake, entry: getEntry(mistake.wordId) }))
      .filter((item) => item.entry)
      .filter((item) => {
        if (!needle || !item.entry) return true
        return (
          item.entry.word.toLowerCase().includes(needle) ||
          item.entry.meaning.toLowerCase().includes(needle)
        )
      })
  }, [state.mistakes, filter, needle])

  const sections = corpus.chapters.flatMap((chapter) => chapter.sections)
  const counts = new Map<string, number>()
  for (const mistake of state.mistakes) {
    counts.set(mistake.sectionId, (counts.get(mistake.sectionId) ?? 0) + 1)
  }

  function start(sectionId: string | 'all') {
    const source =
      sectionId === 'all' ? state.mistakes : state.mistakes.filter((item) => item.sectionId === sectionId)
    const ordered = [...source].sort((a, b) => b.wrong - a.wrong || a.updatedAt.localeCompare(b.updatedAt))
    const entries = mistakeEntries(ordered.map((item) => item.wordId))
    if (!entries.length) return
    const located = sectionId === 'all' ? null : getSection(sectionId)
    onStart({
      kind: 'review',
      title: located ? `${located.id} 错词` : '全部错词',
      kicker: '错词本 · 每组 20 个',
      placeKey: `review:${sectionId}`,
      entries,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-brass uppercase">Wrong words</p>
          <h1 className="font-serif text-4xl">错词本</h1>
          <p className="mt-2 text-sm text-muted">
            答错会记在这里。连续答对 {state.settings.masteryStreak} 次后移出。复习按 20 个一组。
          </p>
        </div>
        <Button variant="solid" disabled={visible.length === 0} onClick={() => start(filter === 'all' ? 'all' : filter)}>
          复习这 {visible.length} 个
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="h-11 rounded-2xl border border-line bg-panel px-3 text-sm"
        >
          <option value="all">全部小节（{state.mistakes.length}）</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.id} {section.title}（{counts.get(section.id) ?? 0}）
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜英文或中文"
          className="h-11 flex-1 rounded-2xl border border-line bg-panel px-4 text-sm"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
          {state.mistakes.length === 0 ? '错词本是空的。听写时写错的词会留在这里。' : '这个筛选下没有错词。'}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-line bg-panel/80">
          {visible.map(({ mistake, entry }) => (
            <li key={mistake.wordId} className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div>
                <p className="font-mono text-lg">{entry?.word}</p>
                <p className="text-sm text-muted">{entry?.meaning}</p>
              </div>
              <div className="text-right text-xs text-faint tabular-nums">
                <p>{mistake.sectionId}</p>
                <p>错过 {mistake.wrong} 次</p>
                <p>
                  连续答对 {mistake.streak}/{state.settings.masteryStreak}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
