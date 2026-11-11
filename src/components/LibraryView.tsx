import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { corpus, getSection, sectionEntries } from '../lib/catalog.ts'
import { chunk } from '../lib/groups.ts'
import { useStudy } from '../context/StudyContext.tsx'
import type { PracticeRequest } from '../types.ts'

export function LibraryView({ onStart }: { onStart: (request: PracticeRequest) => void }) {
  const { state } = useStudy()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ '3': true, '4': true, '5': true, '11': true })
  const needle = query.trim().toLowerCase()

  const chapters = useMemo(() => {
    return corpus.chapters.map((chapter) => ({
      ...chapter,
      sections: chapter.sections.filter((section) => {
        if (!needle) return true
        return (
          section.id.toLowerCase().includes(needle) ||
          section.title.toLowerCase().includes(needle) ||
          chapter.title.toLowerCase().includes(needle)
        )
      }),
    }))
  }, [needle])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>词库</h1>
          <p>
            {corpus.wordCount} 条，{corpus.sectionCount} 个小节。选一节开始听写。
          </p>
        </div>
      </div>

      <label>
        <span className="sr-only">筛选小节</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选小节，例如 5.3 或 短语"
          className="field"
        />
      </label>

      {chapters.every((chapter) => chapter.sections.length === 0) ? (
        <p className="empty">没有匹配的小节。换个编号或关键词试试。</p>
      ) : null}

      {chapters.map((chapter) => {
        if (chapter.sections.length === 0) return null
        const expanded = needle ? true : Boolean(open[chapter.id])
        return (
          <section key={chapter.id} className="panel">
            <button
              type="button"
              className="chapter-head"
              aria-expanded={expanded}
              onClick={() => setOpen((current) => ({ ...current, [chapter.id]: !current[chapter.id] }))}
            >
              <span>
                <span className="chapter-title">
                  {chapter.index} {chapter.title}
                </span>
                <span className="chapter-sub">{chapter.subtitle}</span>
              </span>
              <span className="chapter-meta num">
                {chapter.sections.reduce((sum, section) => sum + section.words.length, 0)} 词
                <ChevronDown size={16} />
              </span>
            </button>
            {expanded ? (
              <ul className="rows">
                {chapter.sections.map((section) => {
                  const stat = state.sections[section.id]
                  const total = section.words.length
                  const heard = Math.min(total, stat?.answered.length ?? 0)
                  const groups = chunk(section.words, state.settings.batchSize).length
                  const place = Math.min(state.places[section.id] ?? 0, Math.max(0, groups - 1))
                  const mistakes = state.mistakes.filter((item) => item.sectionId === section.id).length
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className="row"
                        onClick={() => {
                          const located = getSection(section.id)
                          if (!located) return
                          onStart({
                            kind: 'section',
                            title: `${section.id} ${section.title}`,
                            kicker: `${located.chapterIndex} ${located.chapterTitle}`,
                            placeKey: section.id,
                            entries: sectionEntries(section),
                          })
                        }}
                      >
                        <span className="row-id">{section.id}</span>
                        <span className="row-title">
                          {section.title}
                          {mistakes > 0 ? <span className="count">错 {mistakes}</span> : null}
                          <span className="row-hint">{section.hint}</span>
                        </span>
                        <span className="row-side">
                          <span>
                            {heard} / {total}
                          </span>
                          <span className="bar">
                            <i style={{ width: `${total ? (heard / total) * 100 : 0}%` }} />
                          </span>
                          {place > 0 ? <small className="is-next">继续第 {place + 1} 组</small> : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )
      })}

      <p className="note">{corpus.note}</p>
    </div>
  )
}
