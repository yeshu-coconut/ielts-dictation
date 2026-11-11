import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Shuffle, Volume2, X } from 'lucide-react'
import { useStudy } from '../context/StudyContext.tsx'
import { usePronunciation } from '../hooks/usePronunciation.ts'
import { isCorrect } from '../lib/grade.ts'
import { chunk, clampIndex, shuffleItems } from '../lib/groups.ts'
import { RATES } from '../lib/progress.ts'
import { audioUrl, cn } from '../lib/utils.ts'
import type { Entry, PracticeRequest } from '../types.ts'
import { Button } from './ui/button.tsx'

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
    status === 'playing'
      ? '播放中'
      : status === 'loading'
        ? '准备发音'
        : status === 'blocked'
          ? '点一下播放'
          : status === 'error'
            ? '音频没加载到'
            : '点击重听'
  const isLast = view.cursor >= view.order.length - 1
  const wrongCount = answeredCount - correctCount

  return (
    <div className="page practice">
      <div className="practice-head">
        <button type="button" onClick={onExit} className="back">
          <ChevronLeft size={18} />
          {request.kind === 'review' ? '错词本' : '词库'}
        </button>
        <div className="practice-title">
          <h1>{request.title}</h1>
          <p>{request.kicker}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <button
            type="button"
            className="icon-btn"
            aria-label="上一组"
            onClick={() => changeGroup(groupIndex - 1)}
            disabled={groupIndex === 0}
          >
            <ChevronLeft size={18} />
          </button>
          <select
            value={groupIndex}
            onChange={(event) => changeGroup(Number(event.target.value))}
            className="select select-sm num"
            aria-label="跳到分组"
          >
            {groups.map((items, index) => (
              <option key={items[0]?.id ?? index} value={index}>
                第 {index + 1} / {groupCount} 组
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            aria-label="下一组"
            onClick={() => changeGroup(groupIndex + 1)}
            disabled={groupIndex >= groups.length - 1}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="toolbar-group">
          <select
            value={settings.rate}
            onChange={(event) => {
              const rate = Number(event.target.value)
              setSettings({ rate })
              setRate(rate)
            }}
            className="select select-sm num"
            aria-label="语速"
          >
            {RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
          <button
            type="button"
            className="chip"
            aria-pressed={shuffleOn}
            aria-label="组内乱序"
            onClick={() => setShuffleOn((value) => !value)}
          >
            <Shuffle size={16} />
            <span className="chip-label">{shuffleOn ? '已乱序' : '乱序'}</span>
          </button>
        </div>
      </div>

      <section className="panel sheet">
        <div className="ticks" aria-hidden="true">
          {view.order.map((entry, index) => {
            const mark = view.results[entry.id]
            return (
              <span
                key={entry.id}
                className={mark ? (mark.ok ? 'is-ok' : 'is-bad') : index === view.cursor ? 'is-now' : undefined}
              />
            )
          })}
        </div>
        <div className="sheet-meta">
          <span>
            第 {view.order.length ? view.cursor + 1 : 0} / {view.order.length} 题
          </span>
          <span>
            对 {correctCount}　错 {wrongCount}
          </span>
        </div>

        <div className="listen">
          <button
            type="button"
            onClick={replay}
            className={cn('play', status === 'playing' && 'is-playing')}
            aria-label="重听"
          >
            <Volume2 size={26} />
          </button>
          <p className="listen-status">{statusLabel}</p>
          {status === 'error' ? (
            <p className="listen-error">这个发音文件没有加载成功。确认音频已随站点一起发布。</p>
          ) : null}
        </div>

        <form
          className="answer"
          onSubmit={(event) => {
            event.preventDefault()
            if (result) {
              if (!isLast) goCursor(view.cursor + 1)
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
            placeholder={result ? '这题空着过了' : '在这里拼写'}
            className={cn('answer-input', result && (result.ok ? 'is-ok' : 'is-bad'))}
          />

          {item && result ? (
            <div className={cn('verdict', result.ok ? 'is-ok' : 'is-bad')} role="status">
              <p className="verdict-label">
                {result.ok ? <Check size={14} /> : <X size={14} />}
                {result.ok ? '写对了' : '写错了'}
              </p>
              {result.ok ? null : <p className="verdict-word">{item.word}</p>}
              <p className="verdict-meaning">{item.meaning}</p>
              {result.note ? <p className="verdict-note">{result.note}</p> : null}
            </div>
          ) : (
            <div className="verdict">
              <p className="verdict-wait">听完再写，先别看中文</p>
            </div>
          )}

          <div className="answer-actions">
            <Button variant="solid" size="lg" type="submit" disabled={!item || (Boolean(result) && isLast)}>
              {result ? (isLast ? '本组已核对' : '下一题') : '核对'}
            </Button>
            <div className="answer-more">
              <Button variant="ghost" onClick={() => grade(draft, true)} disabled={!item || Boolean(result)}>
                不会
              </Button>
              <Button variant="ghost" onClick={() => goCursor(view.cursor - 1)} disabled={view.cursor === 0}>
                上一题
              </Button>
            </div>
          </div>
          <p className="keys">
            <kbd>Enter</kbd> 核对或下一题　<kbd>F2</kbd> 重听　<kbd>Ctrl</kbd> + <kbd>Enter</kbd> 记为不会
          </p>
        </form>

        {allDone ? (
          <div className="summary">
            <h2 className="num">
              本组 {correctCount} / {view.order.length}
            </h2>
            <p>答错的词已经在错词本里。可以重练本组，或去下一组。</p>
            <ul className="summary-list">
              {view.order
                .filter((entry) => view.results[entry.id] && !view.results[entry.id]?.ok)
                .map((entry) => (
                  <li key={entry.id}>
                    <span className="word">{entry.word}</span>
                    <span className="meaning">{entry.meaning}</span>
                  </li>
                ))}
              {correctCount === view.order.length ? <li className="all-ok">这一组没有拼错。</li> : null}
            </ul>
            <div className="summary-actions">
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
