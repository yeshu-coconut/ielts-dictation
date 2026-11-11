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
  const stats: Array<[string, string]> = [
    ['听写次数', String(attempts)],
    ['总正确率', percent(correct, attempts)],
    ['错词', String(state.mistakes.length)],
  ]

  return (
    <div className="page">
      <div className="page-head">
        <h1>进度</h1>
      </div>

      <section className="panel panel-pad">
        <div className="today">
          <div>
            <p className="today-label">今日</p>
            <p className="today-count">
              {state.daily.count}
              <span> / {goal}</span>
            </p>
          </div>
          <label className="today-goal">
            每日目标
            <input
              type="number"
              min={5}
              max={500}
              value={goal}
              onChange={(event) => {
                const dailyGoal = Number(event.target.value)
                if (dailyGoal >= 5 && dailyGoal <= 500) setSettings({ dailyGoal: Math.round(dailyGoal) })
              }}
              className="field field-num"
            />
          </label>
        </div>
        <div className="bar">
          <i style={{ width: `${ratio * 100}%` }} />
        </div>
      </section>

      <dl className="panel stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>小节</th>
              <th>已练</th>
              <th>正确率</th>
              <th>完成组</th>
            </tr>
          </thead>
          <tbody>
            {corpus.chapters.flatMap((chapter) =>
              chapter.sections.map((section) => {
                const stat = state.sections[section.id]
                return (
                  <tr key={section.id}>
                    <td>
                      <span className="id">{section.id}</span>
                      {section.title}
                    </td>
                    <td className="dim">
                      {stat?.answered.length ?? 0}/{section.words.length}
                    </td>
                    <td>{percent(stat?.correct ?? 0, stat?.attempts ?? 0)}</td>
                    <td className="dim">{stat?.passes ?? 0}</td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </section>

      <section className="panel panel-pad">
        <h2>最近练习</h2>
        {state.sessions.length === 0 ? (
          <p className="note">完成一组之后，会在这里留下正确率。</p>
        ) : (
          <ul className="log">
            {state.sessions.slice(0, 12).map((session) => (
              <li key={session.id}>
                <span>
                  {session.label}
                  <small>{session.kind === 'review' ? '复习' : '听写'}</small>
                </span>
                <span className="score">
                  {session.correct}/{session.total}
                  <small>{formatWhen(session.at)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel panel-pad stack">
        <h2>备份</h2>
        <p>导出的 JSON 含设置、错词、小节统计和最近记录。导入会覆盖这台浏览器里的进度。</p>
        <div className="btn-row">
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
            hidden
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
        {message ? <p className="message">{message}</p> : null}
      </section>
    </div>
  )
}
