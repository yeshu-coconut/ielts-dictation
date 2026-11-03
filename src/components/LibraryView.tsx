import { useMemo, useState } from 'react'
import { corpus, getSection, sectionEntries } from '../lib/catalog.ts'
import { chunk } from '../lib/groups.ts'
import { percent } from '../lib/utils.ts'
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      <section className="rounded-3xl border border-line bg-panel/80 p-5">
        <p className="text-xs tracking-[0.2em] text-brass uppercase">Listening dictation</p>
        <h1 className="mt-2 font-serif text-4xl text-brass-2">一组一组地听写</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          默认 20 个词一组。英音在构建时已经生成，放在站点里，不临时联网合成。第一次打开会由浏览器缓存，之后断网也能听。
        </p>
        <p className="mt-3 text-xs leading-5 text-faint">{corpus.note}</p>
        <label className="mt-4 block">
          <span className="sr-only">筛选小节</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="筛选小节，例如 5.3 或 短语"
            className="h-11 w-full rounded-2xl border border-line bg-canvas px-4 text-sm text-ink placeholder:text-faint"
          />
        </label>
      </section>

      {chapters.every((chapter) => chapter.sections.length === 0) ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          没有匹配的小节。
        </p>
      ) : null}

      {chapters.map((chapter) =>
        chapter.sections.length === 0 ? null : (
          <section key={chapter.id} className="overflow-hidden rounded-3xl border border-line bg-panel/70">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={needle ? true : Boolean(open[chapter.id])}
              onClick={() => setOpen((current) => ({ ...current, [chapter.id]: !current[chapter.id] }))}
            >
              <span>
                <span className="block text-xs text-brass">{chapter.index}</span>
                <span className="font-serif text-2xl">{chapter.title}</span>
                <span className="mt-1 block text-sm text-muted">{chapter.subtitle}</span>
              </span>
              <span className="text-sm text-faint tabular-nums">
                {chapter.sections.reduce((sum, section) => sum + section.words.length, 0)} 词
              </span>
            </button>
            {(needle || open[chapter.id]) && (
              <ul className="border-t border-line">
                {chapter.sections.map((section) => {
                  const stat = state.sections[section.id]
                  const groups = chunk(section.words, state.settings.batchSize).length
                  const place = state.places[section.id] ?? 0
                  const accuracy = percent(stat?.correct ?? 0, stat?.attempts ?? 0)
                  const mistakes = state.mistakes.filter((item) => item.sectionId === section.id).length
                  return (
                    <li key={section.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full flex-col gap-2 px-5 py-4 text-left hover:bg-panel-2 sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => {
                          const located = getSection(section.id)
                          if (!located) return
                          onStart({
                            kind: 'section',
                            title: `${section.id} ${section.title}`,
                            kicker: `${located.chapterIndex} · ${located.chapterTitle}`,
                            placeKey: section.id,
                            entries: sectionEntries(section),
                          })
                        }}
                      >
                        <span>
                          <span className="text-sm text-brass tabular-nums">{section.id}</span>
                          <span className="ml-2 text-base">{section.title}</span>
                          <span className="mt-1 block text-xs text-faint">{section.hint}</span>
                        </span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted tabular-nums">
                          <span>{section.words.length} 词 · {groups} 组</span>
                          <span>已听 {stat?.answered.length ?? 0}</span>
                          <span>正确率 {accuracy}</span>
                          {mistakes > 0 ? <span className="text-bad">错词 {mistakes}</span> : null}
                          <span className="text-brass-2">{place > 0 ? `继续第 ${place + 1} 组` : '从第 1 组开始'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ),
      )}
    </div>
  )
}
