import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Shuffle, Volume2 } from 'lucide-react'
import { useStudy } from '../context/StudyContext.tsx'
import { usePronunciation } from '../hooks/usePronunciation.ts'
import { isCorrect } from '../lib/grade.ts'
import { chunk, clampIndex, shuffleItems } from '../lib/groups.ts'
import { BATCH_SIZES, RATES, REPEATS } from '../lib/progress.ts'
import { audioUrl, cn, percent } from '../lib/utils.ts'
import type { Entry, PracticeRequest } from '../types.ts'
import { Button } from './ui/button.tsx'
import { Segmented } from './Segmented.tsx'

type Result = { input: string; ok: boolean; note: string }

type Snap = {
  key: string
  shuffleOn: boolean
  order: Entry[]
  cursor: number
  results: Record<string, Result>
  logged: boolean
  passId: string
}

export function PracticeView({ request, onExit }: { request: PracticeRequest; onExit: () => void }) {
  const { state, setSettings, setPlace, recordAnswer, finishPass } = useStudy()
  const { settings } = state
  const batchSize = request.kind === 'review' ? 20 : settings.batchSize
  const groups = useMemo(() => chunk(request.entries, batchSize), [request.entries, batchSize])
  const groupCount = Math.max(1, groups.length)
  const storedIndex = state.places[request.placeKey] ?? 0
  const groupIndex = clampIndex(storedIndex, groups.length)
  const group = groups[groupIndex] ?? []
  const groupKey = `${request.placeKey}:${batchSize}:${groupIndex}:${group.map((entry) => entry.id).join(',')}`

  const [shuffleOn, setShuffleOn] = useState(false)
  const [snap, setSnap] = useState<Snap>(() => ({
    key: groupKey,
    shuffleOn: false,
    order: group,
    cursor: 0,
    results: {},
    logged: false,
    passId: crypto.randomUUID(),
  }))
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const gradedRef = useRef(new Set<string>())
  const { play, stop, setRate, status } = usePronunciation()

  const pending = snap.key !== groupKey || snap.shuffleOn !== shuffleOn
  const view: Snap = pending
    ? {
        key: groupKey,
        shuffleOn,
        order: shuffleOn ? shuffleItems(group) : group,
        cursor: 0,
        results: {},
        logged: false,
        passId: crypto.randomUUID(),
      }
    : snap
  if (pending) {
    setSnap(view)
    setDraft('')
  }

  const item = view.order[view.cursor]
  const result = item ? view.results[item.id] : undefined
  const correctCount = view.order.filter((entry) => view.results[entry.id]?.ok).length
  const answeredCount = view.order.filter((entry) => view.results[entry.id]).length
  const allDone = view.order.length > 0 && answeredCount === view.order.length

  useEffect(() => {
    gradedRef.current = new Set()
  }, [view.passId])

  useEffect(() => {
    inputRef.current?.focus()
  }, [view.cursor, view.key])

  useEffect(() => {
    if (!item || view.results[item.id]) return
    play(audioUrl(item.audio), settings.rate, settings.repeats)
  }, [item, view.cursor, view.key, view.results, play, settings.rate, settings.repeats])

  useEffect(() => {
    const upcoming = view.order.slice(view.cursor + 1, view.cursor + 4)
    const nodes = upcoming.map((entry) => {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = audioUrl(entry.audio)
      return audio
    })
    return () => {
      nodes.forEach((audio) => {
        audio.src = ''
      })
    }
  }, [view.cursor, view.key, view.order])

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [view.key])

  useEffect(() => () => stop(), [stop])

  function clearAdvance() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  function goCursor(next: number) {
    clearAdvance()
    setDraft('')
    setSnap((current) => ({ ...current, cursor: clampIndex(next, current.order.length) }))
  }

  function grade(raw: string, giveUp = false) {
    if (!item || gradedRef.current.has(item.id) || view.results[item.id]) return
    gradedRef.current.add(item.id)
    const ok = !giveUp && isCorrect(raw, item.word, item.alts)
    const existing = state.mistakes.find((mistake) => mistake.wordId === item.id)
    const mastery = settings.masteryStreak
    let note = ''
    if (!ok) note = '已记入错词本'
    else if (existing && existing.streak + 1 >= mastery) note = '连续答对，已从错词本移出'
    else if (existing) note = `错词本进度 ${existing.streak + 1}/${mastery}`
    recordAnswer({ wordId: item.id, sectionId: item.sectionId, ok })
    const results = { ...view.results, [item.id]: { input: raw.trim(), ok, note } }
    const done = view.order.every((entry) => results[entry.id])
    if (done && !view.logged) {
      finishPass({
        id: view.passId,
        at: new Date().toISOString(),
        kind: request.kind,
        sectionId: request.kind === 'section' ? request.placeKey : item.sectionId,
        label: request.title,
        total: view.order.length,
        correct: view.order.filter((entry) => results[entry.id]?.ok).length,
      })
    }
    setSnap((current) => ({ ...current, results, logged: current.logged || done }))
    stop()
    if (ok && settings.autoNext && view.cursor < view.order.length - 1) {
      clearAdvance()
      timerRef.current = window.setTimeout(() => {
        setDraft('')
        setSnap((current) => ({ ...current, cursor: Math.min(current.order.length - 1, current.cursor + 1) }))
      }, 1100)
    }
  }

  function replay() {
    if (!item) return
    play(audioUrl(item.audio), settings.rate, settings.repeats)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        replay()
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        grade('', true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // replay/grade close over the latest item via render; rebind each render.
  })

  function changeGroup(index: number) {
    clearAdvance()
    setPlace(request.placeKey, clampIndex(index, groups.length))
  }

  const statusLabel =
    status === 'playing' ? '播放中' : status === 'loading' ? '准备发音' : status === 'blocked' ? '点一下播放' : status === 'error' ? '音频没加载到' : '听写'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 pb-24 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="text-sm text-muted hover:text-ink">
          ← 返回
        </button>
        <div className="text-right">
          <p className="text-xs text-brass">{request.kicker}</p>
          <h1 className="font-serif text-2xl">{request.title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel/80 p-3">
        <Button size="sm" variant="ghost" onClick={() => changeGroup(groupIndex - 1)} disabled={groupIndex === 0}>
          <ChevronLeft size={16} /> 上一组
        </Button>
        <label className="text-sm text-muted">
          <span className="sr-only">跳到分组</span>
          <select
            value={groupIndex}
            onChange={(event) => changeGroup(Number(event.target.value))}
            className="rounded-full border border-line bg-canvas px-3 py-1 text-ink"
          >
            {groups.map((items, index) => (
              <option key={items[0]?.id ?? index} value={index}>
                第 {index + 1} / {groupCount} 组
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => changeGroup(groupIndex + 1)}
          disabled={groupIndex >= groups.length - 1}
        >
          下一组 <ChevronRight size={16} />
        </Button>
        <Button size="sm" variant={shuffleOn ? 'solid' : 'quiet'} onClick={() => setShuffleOn((value) => !value)}>
          <Shuffle size={14} /> {shuffleOn ? '已乱序' : '组内乱序'}
        </Button>
        {request.kind === 'review' ? (
          <span className="ml-auto text-xs text-faint">错词复习固定 20 词一组</span>
        ) : (
          <label className="ml-auto text-sm text-muted">
            <span className="mr-2 text-xs text-faint">每组</span>
            <select
              value={settings.batchSize}
              onChange={(event) => setSettings({ batchSize: Number(event.target.value) as 10 | 20 | 30 | 50 })}
              className="rounded-full border border-line bg-canvas px-3 py-1 text-ink"
            >
              {BATCH_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} 词
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className="rounded-3xl border border-line bg-panel/85 px-5 py-6 sm:px-8">
        <div className="mb-5 flex items-center justify-between text-xs text-faint tabular-nums">
          <span>
            {view.cursor + 1} / {view.order.length || 0}
          </span>
          <span>
            本组 {correctCount}/{answeredCount || 0}
            {answeredCount ? ` · ${percent(correctCount, answeredCount)}` : ''}
          </span>
        </div>
        <div className="mb-6 flex gap-1" aria-hidden="true">
          {view.order.map((entry, index) => {
            const mark = view.results[entry.id]
            return (
              <span
                key={entry.id}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  mark ? (mark.ok ? 'bg-good' : 'bg-bad') : index === view.cursor ? 'bg-brass' : 'bg-line',
                )}
              />
            )
          })}
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={replay}
            className={cn(
              'grid h-16 w-16 place-items-center rounded-full border border-brass/50 bg-canvas text-brass shadow-[0_0_40px_rgba(228,180,92,0.15)] sm:h-24 sm:w-24',
              status === 'playing' && 'animate-pulse',
            )}
            aria-label="重听"
          >
            <Volume2 size={32} />
          </button>
          <p className="text-sm text-muted">{statusLabel} · 本地英音</p>
          {status === 'error' ? (
            <p className="text-center text-sm text-bad">这个发音文件没有加载成功。确认音频已随站点一起发布。</p>
          ) : null}
        </div>

        {item && result ? (
          <div className="mt-6 text-center">
            <p className={cn('text-xs tracking-wide', result.ok ? 'text-good' : 'text-bad')}>
              {result.ok ? '正确' : '再看一遍拼写'}
            </p>
            {!result.ok && result.input ? (
              <p className="mt-2 text-sm text-bad line-through decoration-bad/70">{result.input}</p>
            ) : null}
            {!result.ok && !result.input ? <p className="mt-2 text-sm text-faint">这题空着过了</p> : null}
            <p className="mt-2 font-serif text-3xl leading-tight break-words text-brass-2 sm:text-4xl">{item.word}</p>
            <p className="mt-2 text-lg text-ink">{item.meaning}</p>
            {result.note ? <p className="mt-2 text-sm text-muted">{result.note}</p> : null}
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-faint">听完再写。先别看中文。</p>
        )}

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (result) {
              if (view.cursor < view.order.length - 1) goCursor(view.cursor + 1)
              return
            }
            grade(draft)
          }}
        >
          <label className="sr-only" htmlFor="dictation-input">
            拼写
          </label>
          <input
            id="dictation-input"
            ref={inputRef}
            value={result ? result.input : draft}
            readOnly={Boolean(result)}
            onChange={(event) => setDraft(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="在这里拼写，Enter 核对"
            className="w-full border-0 border-b border-line bg-transparent py-3 text-center font-mono text-2xl text-ink outline-none placeholder:text-base placeholder:text-faint focus:border-brass"
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="solid" type="submit" disabled={!item}>
              {result ? (view.cursor < view.order.length - 1 ? '下一题' : '本组已核对') : '核对'}
            </Button>
            <Button variant="quiet" onClick={replay} disabled={!item}>
              重听
            </Button>
            <Button variant="ghost" onClick={() => grade(draft, true)} disabled={!item || Boolean(result)}>
              不会
            </Button>
            <Button variant="ghost" onClick={() => goCursor(view.cursor - 1)} disabled={view.cursor === 0}>
              上一题
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-faint">
            Enter 核对或下一题 · F2 重听 · Ctrl+Enter 记为不会
          </p>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Segmented
            label="语速"
            value={settings.rate}
            options={RATES.map((rate) => ({ value: rate, label: `${rate}×` }))}
            onChange={(rate) => {
              setSettings({ rate })
              setRate(rate)
            }}
          />
          <Segmented
            label="重复"
            value={settings.repeats}
            options={REPEATS.map((count) => ({ value: count, label: `${count} 次` }))}
            onChange={(repeats) => setSettings({ repeats })}
          />
        </div>

        {allDone ? (
          <div className="mt-6 rounded-2xl border border-line bg-canvas/70 p-4">
            <p className="font-serif text-2xl text-brass-2">
              本组 {correctCount}/{view.order.length}
            </p>
            <p className="mt-1 text-sm text-muted">答错的词已经在错词本里。可以重练本组，或去下一组。</p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-sm">
              {view.order.filter((entry) => view.results[entry.id] && !view.results[entry.id]?.ok).map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3">
                  <span className="font-mono text-bad">{entry.word}</span>
                  <span className="text-muted">{entry.meaning}</span>
                </li>
              ))}
              {correctCount === view.order.length ? <li className="text-good">这一组没有拼错。</li> : null}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="solid"
                disabled={groupIndex >= groups.length - 1}
                onClick={() => changeGroup(groupIndex + 1)}
              >
                下一组
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  clearAdvance()
                  gradedRef.current = new Set()
                  setDraft('')
                  setSnap((current) => ({
                    ...current,
                    cursor: 0,
                    results: {},
                    logged: false,
                    passId: crypto.randomUUID(),
                    order: current.shuffleOn ? shuffleItems(group) : group,
                  }))
                }}
              >
                重练本组
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
