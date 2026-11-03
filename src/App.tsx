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

type View = 'library' | 'practice' | 'mistakes' | 'progress'

function Shell() {
  const { state } = useStudy()
  const [view, setView] = useState<View>('library')
  const [practice, setPractice] = useState<PracticeRequest | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const goal = state.settings.dailyGoal
  const today = `${state.daily.count}/${goal}`

  function openPractice(request: PracticeRequest) {
    setPractice(request)
    setView('practice')
  }

  const nav = [
    { id: 'library' as const, label: '词库', icon: Library },
    { id: 'mistakes' as const, label: '错词', icon: BookMarked },
    { id: 'progress' as const, label: '进度', icon: ChartColumn },
  ]

  return (
    <div className={cn('min-h-svh', view === 'practice' ? 'pb-6' : 'pb-20 sm:pb-8')}>
      <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-brass/40 text-brass" aria-hidden="true">
            <span className="text-lg leading-none">听</span>
          </div>
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none">雅思听力听写</p>
            <p className="mt-1 text-xs text-faint">英音已打包 · 可离线</p>
          </div>
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm',
                  view === item.id ? 'bg-panel-2 text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto rounded-full p-2 text-muted hover:bg-panel-2 hover:text-ink sm:ml-0"
            aria-label="设置"
          >
            <Settings size={18} />
          </button>
          <p className="text-xs text-brass tabular-nums">今日 {today}</p>
        </div>
      </header>

      {view === 'practice' && practice ? (
        <PracticeView request={practice} onExit={() => setView('library')} />
      ) : null}
      {view === 'library' ? <LibraryView onStart={openPractice} /> : null}
      {view === 'mistakes' ? <MistakesView onStart={openPractice} /> : null}
      {view === 'progress' ? <ProgressView /> : null}

      {view === 'practice' ? null : (
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 backdrop-blur sm:hidden">
        <ul className="mx-auto grid max-w-3xl grid-cols-3 pb-[env(safe-area-inset-bottom)]">
          {nav.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setView(item.id)}
                  className={cn(
                    'flex w-full flex-col items-center gap-1 py-2 text-xs',
                    active ? 'text-brass' : 'text-faint',
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
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
