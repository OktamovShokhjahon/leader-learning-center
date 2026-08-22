import { describe, it, expect } from 'vitest'
import { parseGiftText, parseSheetRows, toLocalizedQuestions } from './test-import.js'

/**
 * The format comes from the client's own sample (`Passive voice.txt`), so these
 * cases are lifted from it verbatim rather than invented — including the awkward
 * ones: a prompt split over two lines, a curly apostrophe, and an option
 * containing a slash.
 */
const SAMPLE = `﻿The new film … in all the big theatres of Tashkent now.
{
~Is demonstrated
~Was being demonstrated
=Is being demonstrated
~Would be demonstrated
}

The exercises … usually … by the teacher at home.
{
=Are/corrected
~Is/corrected
~Was/corrected
~Have/been corrected
}

Two new companies are building a motorway through the town.
A motorway … through the town.
{
~Is built
~Are being built
~Are building
=Is being built
}
`

describe('parseGiftText', () => {
  it('reads the client sample format', () => {
    const { questions, issues } = parseGiftText(SAMPLE)

    expect(issues).toEqual([])
    expect(questions).toHaveLength(3)

    expect(questions[0]?.prompt).toBe(
      'The new film … in all the big theatres of Tashkent now.',
    )
    expect(questions[0]?.options).toHaveLength(4)
    // `=Is being demonstrated` is the third option, so key C.
    expect(questions[0]?.correctKey).toBe('C')
  })

  it('strips the BOM Windows editors leave on the first line', () => {
    expect(parseGiftText(SAMPLE).questions[0]?.prompt.startsWith('﻿')).toBe(false)
  })

  it('joins a prompt that runs over several lines', () => {
    const motorway = parseGiftText(SAMPLE).questions[2]
    expect(motorway?.prompt).toBe(
      'Two new companies are building a motorway through the town. A motorway … through the town.',
    )
  })

  it('keeps a slash inside an option rather than splitting on it', () => {
    const exercises = parseGiftText(SAMPLE).questions[1]
    expect(exercises?.options[0]?.text).toBe('Are/corrected')
    expect(exercises?.correctKey).toBe('A')
  })

  /**
   * A mis-keyed question marks a correct student wrong, so these are reported
   * rather than guessed at.
   */
  it('reports a question with no correct answer instead of guessing', () => {
    const { questions, issues } = parseGiftText('No key here\n{\n~One\n~Two\n}\n')
    expect(questions).toHaveLength(0)
    expect(issues[0]?.code).toBe('noCorrect')
  })

  it('reports a question with two correct answers', () => {
    const { issues } = parseGiftText('Two keys\n{\n=One\n=Two\n}\n')
    expect(issues[0]?.code).toBe('manyCorrect')
  })

  it('reports a block that is never closed, and still returns what it read', () => {
    const { questions, issues } = parseGiftText(
      'Good one\n{\n~A\n=B\n}\n\nTruncated\n{\n~A\n=B\n',
    )
    expect(questions).toHaveLength(2)
    expect(issues.some((issue) => issue.code === 'unclosedBlock')).toBe(true)
  })

  it('reports a question with only one option', () => {
    const { issues } = parseGiftText('Lonely\n{\n=Only\n}\n')
    expect(issues[0]?.code).toBe('tooFewOptions')
  })
})

describe('parseSheetRows', () => {
  const header = ['Question', 'A', 'B', 'C', 'D', 'Correct']

  it('accepts the correct answer as a letter', () => {
    const { questions } = parseSheetRows([header, ['Q1', 'one', 'two', 'three', 'four', 'C']])
    expect(questions[0]?.correctKey).toBe('C')
  })

  it('accepts it as a 1-based number', () => {
    const { questions } = parseSheetRows([header, ['Q1', 'one', 'two', 'three', 'four', '2']])
    expect(questions[0]?.correctKey).toBe('B')
  })

  it('accepts it as the answer text, case-insensitively', () => {
    const { questions } = parseSheetRows([header, ['Q1', 'one', 'two', 'three', 'four', 'THREE']])
    expect(questions[0]?.correctKey).toBe('C')
  })

  it('works without a header row', () => {
    const { questions } = parseSheetRows([['Q1', 'one', 'two', 'A']])
    expect(questions).toHaveLength(1)
    expect(questions[0]?.correctKey).toBe('A')
  })

  it('skips blank padding rows without calling them errors', () => {
    const { questions, issues } = parseSheetRows([header, ['', '', '', '', '', ''], ['Q1', 'a', 'b', 'c', 'd', 'A']])
    expect(questions).toHaveLength(1)
    expect(issues).toEqual([])
  })

  it('reports a row whose answer matches no option', () => {
    const { issues } = parseSheetRows([header, ['Q1', 'one', 'two', 'three', 'four', 'zzz']])
    expect(issues[0]?.code).toBe('noCorrect')
  })
})

describe('toLocalizedQuestions', () => {
  it('puts an uz import in uz alone, since ru and en fall back to it (§21.2)', () => {
    const { questions } = parseGiftText(SAMPLE)
    const localized = toLocalizedQuestions(questions, 'uz')
    expect(localized[0]?.prompt).toEqual({ uz: questions[0]?.prompt })
  })

  it('mirrors an en import into uz, which is the required locale', () => {
    const { questions } = parseGiftText(SAMPLE)
    const localized = toLocalizedQuestions(questions, 'en')
    expect(localized[0]?.prompt.uz).toBe(questions[0]?.prompt)
    expect(localized[0]?.prompt.en).toBe(questions[0]?.prompt)
  })
})
