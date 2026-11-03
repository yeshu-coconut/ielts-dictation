import { useRef, useState } from 'react'
import { corpus } from '../lib/catalog.ts'
import { useStudy } from '../context/StudyContext.tsx'
import { formatWhen, percent } from '../lib/utils.ts'
import { Button } from './ui/button.tsx'

export function ProgressView() {
  const { state, download, importJson, reset, setSettings } = useStudy()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const attempts = Object.values(state.sections).reduce((sum, stat) => sum + stat.attempts, 0)
  const correct = Object.values(state.sections).reduce((sum, stat) => sum + stat.correct, 0)
  const goal = state.settings.dailyGoal
  const ratio = Math.min(1, goal ? state.daily.count / goal : 0)
  const radius = 28
  const circumference = 2 * Math.PI * radius

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.2em] text-brass uppercase">Progress</p>
        <h1 className="font-serif text-4xl">进度</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 rounded-3xl border border-line bg-panel p-4">
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
            <circle cx="38" cy="38" r={radius} fill="none" stroke="#313a4a" strokeWidth="6" />
            <circle
              cx="38"
              cy="38"
              r={radius}
              fill="none"
              stroke="#e4b45c"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              transform="rotate(-90 38 38)"
            />
          </svg>
          <div>
            <p className="text-xs text-faint">今日</p>
            <p className="font-serif text-3xl tabular-nums">
              {state.daily.count}
              <span className="text-lg text-muted">/{goal}</span>
            </p>
            <label className="mt-1 block text-xs text-muted">
              目标
              <input
                type="number"
                min={5}
                max={500}
                value={goal}
                onChange={(event) => {
                  const dailyGoal = Number(event.target.value)
                  if (dailyGoal >= 5 && dailyGoal <= 500) setSettings({ dailyGoal: Math.round(dailyGoal) })
                }}
                className="ml-2 w-16 rounded-lg border border-line bg-canvas px-2 py-1 text-ink"
              />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['听写次数', String(attempts)],
            ['总正确率', percent(correct, attempts)],
            ['错词', String(state.mistakes.length)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-line bg-panel p-4">
              <p className="text-xs text-faint">{label}</p>
              <p className="mt-2 font-serif text-2xl tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs text-faint">
            <tr>
              <th className="px-4 py-3 font-medium">小节</th>
              <th className="px-3 py-3 font-medium">已练</th>
              <th className="px-3 py-3 font-medium">正确率</th>
              <th className="px-3 py-3 font-medium">完成组</th>
            </tr>
          </thead>
          <tbody>
            {corpus.chapters.flatMap((chapter) =>
              chapter.sections.map((section) => {
                const stat = state.sections[section.id]
                return (
                  <tr key={section.id} className="border-t border-line">
                    <td className="px-4 py-2">
                      <span className="text-brass tabular-nums">{section.id}</span> {section.title}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted">
                      {stat?.answered.length ?? 0}/{section.words.length}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{percent(stat?.correct ?? 0, stat?.attempts ?? 0)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{stat?.passes ?? 0}</td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="font-serif text-2xl">最近练习</h2>
        {state.sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">完成一组之后，会在这里留下正确率。</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {state.sessions.slice(0, 12).map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="text-ink">{session.label}</span>
                  <span className="ml-2 text-xs text-faint">{session.kind === 'review' ? '复习' : '听写'}</span>
                </span>
                <span className="text-right text-muted tabular-nums">
                  {session.correct}/{session.total}
                  <span className="ml-2 text-xs">{formatWhen(session.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4">
        <h2 className="font-serif text-2xl">备份</h2>
        <p className="text-sm text-muted">导出的 JSON 含设置、错词、小节统计和最近记录。导入会覆盖这台浏览器里的进度。</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="solid" onClick={download}>
            导出 JSON
          </Button>
          <Button variant="quiet" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try {
                const raw = JSON.parse(await file.text()) as unknown
                const error = importJson(raw)
                setMessage(error ?? '已导入进度。')
              } catch {
                setMessage('这个文件读不了，确认它是 JSON。')
              }
            }}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (!armed) {
                setArmed(true)
                setMessage('再点一次「清除进度」才会删掉本机记录。')
                return
              }
              reset()
              setArmed(false)
              setMessage('本机进度已清除。')
            }}
          >
            清除进度
          </Button>
        </div>
        {message ? <p className="text-sm text-brass-2">{message}</p> : null}
      </section>
    </div>
  )
}
