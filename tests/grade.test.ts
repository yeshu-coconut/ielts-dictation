import { describe, expect, it } from 'vitest'
import { isCorrect, normalizeAnswer } from '../src/lib/grade.ts'
import { chunk, shuffleItems } from '../src/lib/groups.ts'
import { defaultState, finishPass, recordAnswer } from '../src/lib/progress.ts'

describe('grading', () => {
  it('ignores case and surrounding space', () => {
    expect(isCorrect('  Accommodation ', 'accommodation')).toBe(true)
  })

  it('treats hyphens and spaces as the same', () => {
    expect(isCorrect('non smoker', 'non-smoker')).toBe(true)
    expect(isCorrect('non-smoker', 'non-smoker', ['nonsmoker'])).toBe(true)
    expect(isCorrect('nonsmoker', 'non-smoker', ['nonsmoker'])).toBe(true)
  })

  it('accepts a listed American spelling', () => {
    expect(isCorrect('sports center', 'sports centre', ['sports center'])).toBe(true)
  })

  it('accepts an apostrophe dropped only when the answer has one', () => {
    expect(isCorrect('you cant miss it', "you can't miss it")).toBe(true)
    expect(isCorrect('its', "it's")).toBe(true)
    expect(isCorrect("it's", 'its')).toBe(false)
  })

  it('rejects a misspelling and an empty attempt', () => {
    expect(isCorrect('accomodation', 'accommodation')).toBe(false)
    expect(isCorrect('   ', 'accommodation')).toBe(false)
    expect(normalizeAnswer('Hall—of  Residence!')).toBe('hall of residence')
  })
})

describe('groups', () => {
  it('splits a remainder into the last group', () => {
    const groups = chunk([1, 2, 3, 4, 5], 2)
    expect(groups).toEqual([[1, 2], [3, 4], [5]])
  })

  it('shuffles without losing items', () => {
    const items = ['a', 'b', 'c', 'd']
    let seed = 3
    const shuffled = shuffleItems(items, () => {
      seed = (seed * 7) % 11
      return seed / 11
    })
    expect(shuffled.slice().sort()).toEqual(items)
    expect(shuffled).not.toEqual(items)
  })
})

describe('progress', () => {
  it('removes a mistake after the mastery streak', () => {
    const at = new Date('2026-11-03T08:00:00')
    let state = defaultState(at)
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: false, at })
    expect(state.mistakes).toHaveLength(1)
    expect(state.daily).toEqual({ date: '2026-11-03', count: 1 })
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: true, at })
    expect(state.mistakes[0]?.streak).toBe(1)
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: true, at })
    expect(state.mistakes).toHaveLength(0)
    expect(state.sections['3.2']?.correct).toBe(2)
    expect(state.sections['3.2']?.attempts).toBe(3)
  })

  it('resets the streak when the word is wrong again', () => {
    const at = new Date('2026-11-03T09:00:00')
    let state = defaultState(at)
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: false, at })
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: true, at })
    state = recordAnswer(state, { wordId: '3.2-001', sectionId: '3.2', ok: false, at })
    expect(state.mistakes[0]).toMatchObject({ streak: 0, wrong: 2 })
  })

  it('counts a finished group once', () => {
    const state = finishPass(defaultState(), {
      id: 'pass-1',
      at: '2026-11-03T10:00:00.000Z',
      kind: 'section',
      sectionId: '3.2',
      label: '3.2 名词预热',
      total: 20,
      correct: 16,
    })
    const again = finishPass(state, {
      id: 'pass-1',
      at: '2026-11-03T10:00:00.000Z',
      kind: 'section',
      sectionId: '3.2',
      label: '3.2 名词预热',
      total: 20,
      correct: 16,
    })
    expect(again.sections['3.2']?.passes).toBe(1)
    expect(again.sessions).toHaveLength(1)
  })
})
