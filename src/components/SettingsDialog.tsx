import { Dialog } from './ui/dialog.tsx'
import { Segmented } from './Segmented.tsx'
import { useStudy } from '../context/StudyContext.tsx'
import { BATCH_SIZES, MASTERY, RATES, REPEATS } from '../lib/progress.ts'

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, setSettings } = useStudy()
  const { settings } = state
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="练习设置" description="都存在这台浏览器里，换设备请用进度页的导出。">
      <div className="flex flex-col gap-5">
        <Segmented
          label="每组词数"
          value={settings.batchSize}
          options={BATCH_SIZES.map((size) => ({ value: size, label: String(size) }))}
          onChange={(batchSize) => setSettings({ batchSize })}
        />
        <Segmented
          label="语速"
          value={settings.rate}
          options={RATES.map((rate) => ({ value: rate, label: `${rate}×` }))}
          onChange={(rate) => setSettings({ rate })}
        />
        <Segmented
          label="每词重复"
          value={settings.repeats}
          options={REPEATS.map((count) => ({ value: count, label: `${count} 次` }))}
          onChange={(repeats) => setSettings({ repeats })}
        />
        <Segmented
          label="答对后"
          value={settings.autoNext ? 'auto' : 'stay'}
          options={[
            { value: 'auto', label: '自动下一题' },
            { value: 'stay', label: '停住看释义' },
          ]}
          onChange={(value) => setSettings({ autoNext: value === 'auto' })}
        />
        <Segmented
          label="错词连续答对几次后移出"
          value={settings.masteryStreak}
          options={MASTERY.map((count) => ({ value: count, label: `${count} 次` }))}
          onChange={(masteryStreak) => setSettings({ masteryStreak })}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-wide text-faint">今日目标（词）</span>
          <input
            type="number"
            min={5}
            max={500}
            value={settings.dailyGoal}
            onChange={(event) => {
              const dailyGoal = Number(event.target.value)
              if (dailyGoal >= 5 && dailyGoal <= 500) setSettings({ dailyGoal: Math.round(dailyGoal) })
            }}
            className="h-10 w-28 rounded-xl border border-line bg-canvas px-3 text-ink"
          />
        </label>
      </div>
    </Dialog>
  )
}
