/** Compare a dictation attempt with the canonical spelling. Case, hyphen, and extra space do not matter. */
export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[-/]+/g, ' ')
    .replace(/[^a-z0-9'\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function loose(input: string): string {
  return normalizeAnswer(input).replace(/'/g, '')
}

export function isCorrect(input: string, word: string, alts: string[] = []): boolean {
  const guess = normalizeAnswer(input)
  if (!guess) return false
  return [word, ...alts].some((target) => {
    if (guess === normalizeAnswer(target)) return true
    return /['’]/.test(target) && loose(input) === loose(target) && loose(target).length > 0
  })
}
