import { useState } from 'react'
import { BookMarked, ChartColumn, Library, Settings } from 'lucide-react'
import { StudyProvider, useStudy } from './context/StudyContext.tsx'
import { LibraryView } from './components/LibraryView.tsx'
import { MistakesView } from './components/MistakesView.tsx'
import { PracticeView } from './components/PracticeView.tsx'
import { ProgressView } from './components/ProgressView.tsx'
import { SettingsDialog } from './components/SettingsDialog.tsx'
import type { PracticeRequest } from './types.ts'
import { cn } from './lib/utils.ts'

type Tab = 'library' | 'mistakes' | 'progress'
type View = Tab | 'practice'

const nav = [
  { id: 'library' as const, label: '词库', icon: Library },
  { id: 'mistakes' as const, label: '错词', icon: BookMarked },
  { id: 'progress' as const, label: '进度', icon: ChartColumn },
]

function Shell() {
  const { state } = useStudy()
  const [view, setView] = useState<View>('library')
  const [practice, setPractice] = useState<PracticeRequest | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const goal = state.settings.dailyGoal
  const done = state.daily.count
  const ratio = Math.min(1, goal ? done / goal : 0)
  const mistakeCount = state.mistakes.length
  const practising = view === 'practice' && practice !== null
  // While practising, keep the tab the session was started from highlighted.
  const origin: Tab = practice?.kind === 'review' ? 'mistakes' : 'library'
  const current: Tab = view === 'practice' ? origin : view

  function openPractice(request: PracticeRequest) {
    setPractice(request)
    setView('practice')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <p className="brand">雅思听力听写</p>
        <nav aria-label="主导航">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="nav-item"
                aria-current={current === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                {item.label}
                {item.id === 'mistakes' && mistakeCount > 0 ? <span className="count">{mistakeCount}</span> : null}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="goal">
            <div className="goal-row">
              <span>今日</span>
              <span className="num">
                <b>{done}</b> / {goal}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
          <button type="button" className="nav-item" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            设置
          </button>
        </div>
      </aside>

      <header className="topbar">
        <p className="brand">雅思听力听写</p>
        <p className="topbar-today num">
          今日 {done} / {goal}
        </p>
        <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="设置">
          <Settings size={18} />
        </button>
      </header>

      <main className={cn('main', practising && 'is-practice')}>
        {view === 'practice' && practice ? <PracticeView request={practice} onExit={() => setView(origin)} /> : null}
        {view === 'library' ? <LibraryView onStart={openPractice} /> : null}
        {view === 'mistakes' ? <MistakesView onStart={openPractice} /> : null}
        {view === 'progress' ? <ProgressView /> : null}
      </main>

      {practising ? null : (
        <nav className="tabbar" aria-label="主导航">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="tab"
                aria-current={current === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon size={20} />
                {item.label}
                {item.id === 'mistakes' && mistakeCount > 0 ? <span className="count">{mistakeCount}</span> : null}
              </button>
            )
          })}
        </nav>
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

export default function App() {
  return (
    <StudyProvider>
      <Shell />
    </StudyProvider>
  )
}
