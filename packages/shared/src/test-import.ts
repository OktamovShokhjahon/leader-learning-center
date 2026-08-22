/**
 * Importing a test from a file the teacher already has.
 *
 * Uzbek learning centres write tests in the Moodle/GIFT style, which is what the
 * client's own sample uses:
 *
 *     The new film … in all the big theatres of Tashkent now.
 *     {
 *     ~Is demonstrated
 *     ~Was being demonstrated
 *     =Is being demonstrated
 *     ~Would be demonstrated
 *     }
 *
 * `=` marks the correct option and `~` a distractor. A question may run over
 * several lines before the brace, which the sample does too.
 *
 * Parsing lives here rather than in the API so the browser can preview and
 * validate an upload before it is sent, and so both sides agree on what a
 * malformed file means.
 */
import type { Localized } from './locales.js'

export type ParsedQuestion = {
  key: string
  prompt: string
  options: { key: string; text: string }[]
  correctKey: string
}

export type ParseIssue = {
  /** 1-based line in the source, so the teacher can find it. */
  line: number
  code:
    | 'noOptions'
    | 'noCorrect'
    | 'manyCorrect'
    | 'tooFewOptions'
    | 'tooManyOptions'
    | 'noPrompt'
    | 'unclosedBlock'
  detail?: string
}

export type ParseResult = {
  questions: ParsedQuestion[]
  issues: ParseIssue[]
}

/** A, B, C… — stable per question, and what the stored answer refers to. */
const optionKey = (index: number) => String.fromCharCode(65 + index)

/**
 * Parses the GIFT-style text format.
 *
 * Deliberately forgiving about whitespace, blank lines and the BOM Windows
 * editors leave behind, and deliberately strict about the answer key: a
 * question with no `=`, or with more than one, is reported rather than guessed
 * at. A silently mis-keyed question would mark a correct student wrong.
 */
export function parseGiftText(source: string): ParseResult {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/)

  const questions: ParsedQuestion[] = []
  const issues: ParseIssue[] = []

  let promptLines: string[] = []
  let promptStartLine = 0
  let options: { text: string; correct: boolean }[] | null = null
  let blockStartLine = 0

  const flush = (endLine: number) => {
    if (options === null && promptLines.length === 0) return

    const prompt = promptLines.join(' ').trim()

    if (options === null) {
      // Text with no option block is a stray line, not a question.
      if (prompt) issues.push({ line: promptStartLine, code: 'noOptions', detail: prompt })
      promptLines = []
      return
    }

    if (!prompt) {
      issues.push({ line: blockStartLine, code: 'noPrompt' })
    } else if (options.length < 2) {
      issues.push({ line: blockStartLine, code: 'tooFewOptions', detail: prompt })
    } else if (options.length > 6) {
      issues.push({ line: blockStartLine, code: 'tooManyOptions', detail: prompt })
    } else {
      const correctCount = options.filter((option) => option.correct).length
      if (correctCount === 0) {
        issues.push({ line: blockStartLine, code: 'noCorrect', detail: prompt })
      } else if (correctCount > 1) {
        issues.push({ line: blockStartLine, code: 'manyCorrect', detail: prompt })
      } else {
        const index = questions.length
        const built = options.map((option, position) => ({
          key: optionKey(position),
          text: option.text,
        }))
        questions.push({
          key: `q${index + 1}`,
          prompt,
          options: built,
          correctKey: optionKey(options.findIndex((option) => option.correct)),
        })
      }
    }

    promptLines = []
    options = null
    void endLine
  }

  lines.forEach((raw, index) => {
    const line = raw.trim()
    const lineNumber = index + 1

    if (line === '{') {
      options = []
      blockStartLine = lineNumber
      return
    }

    if (line === '}') {
      flush(lineNumber)
      return
    }

    if (options !== null) {
      if (line === '') return
      // `=` correct, `~` distractor. Anything else inside a block is a
      // continuation of the option above it.
      const marker = line[0]
      if (marker === '=' || marker === '~') {
        options.push({ text: line.slice(1).trim(), correct: marker === '=' })
      } else if (options.length > 0) {
        const last = options[options.length - 1]!
        last.text = `${last.text} ${line}`.trim()
      }
      return
    }

    if (line === '') {
      // A blank line between questions ends any stray prompt.
      if (promptLines.length > 0) flush(lineNumber)
      return
    }

    if (promptLines.length === 0) promptStartLine = lineNumber
    promptLines.push(line)
  })

  // A file that ends mid-block still yields what it can, and says so.
  if (options !== null) {
    issues.push({ line: blockStartLine, code: 'unclosedBlock' })
    flush(lines.length)
  } else if (promptLines.length > 0) {
    flush(lines.length)
  }

  return { questions, issues }
}

/**
 * Parses rows lifted from a spreadsheet.
 *
 * Expected shape, header row included:
 *   Question | Option A | Option B | Option C | Option D | Correct
 *
 * `Correct` may be the letter (`C`), the 1-based number (`3`), or the answer
 * text itself — teachers fill these in by hand and all three turn up.
 */
export function parseSheetRows(rows: string[][]): ParseResult {
  const questions: ParsedQuestion[] = []
  const issues: ParseIssue[] = []

  if (rows.length === 0) return { questions, issues }

  const header = rows[0]!.map((cell) => String(cell ?? '').trim().toLowerCase())
  const looksLikeHeader = header.some((cell) => /question|savol|вопрос/.test(cell))
  const body = looksLikeHeader ? rows.slice(1) : rows

  const correctIndex = header.findIndex((cell) => /correct|to‘g‘ri|togri|ответ/.test(cell))

  body.forEach((row, index) => {
    const lineNumber = index + (looksLikeHeader ? 2 : 1)
    const cells = row.map((cell) => String(cell ?? '').trim())

    const prompt = cells[0] ?? ''
    if (!prompt) return // a blank row is padding, not an error

    // The answer column is the detected one, or the last non-empty cell.
    const answerAt = correctIndex >= 0 ? correctIndex : cells.length - 1
    const answerRaw = cells[answerAt] ?? ''
    const optionCells = cells.slice(1, answerAt).filter(Boolean)

    if (optionCells.length < 2) {
      issues.push({ line: lineNumber, code: 'tooFewOptions', detail: prompt })
      return
    }
    if (optionCells.length > 6) {
      issues.push({ line: lineNumber, code: 'tooManyOptions', detail: prompt })
      return
    }

    let correctAt = -1
    const upper = answerRaw.toUpperCase()

    if (/^[A-F]$/.test(upper)) {
      correctAt = upper.charCodeAt(0) - 65
    } else if (/^\d+$/.test(answerRaw)) {
      correctAt = Number(answerRaw) - 1
    } else {
      correctAt = optionCells.findIndex(
        (option) => option.toLowerCase() === answerRaw.toLowerCase(),
      )
    }

    if (correctAt < 0 || correctAt >= optionCells.length) {
      issues.push({ line: lineNumber, code: 'noCorrect', detail: prompt })
      return
    }

    questions.push({
      key: `q${questions.length + 1}`,
      prompt,
      options: optionCells.map((text, position) => ({ key: optionKey(position), text })),
      correctKey: optionKey(correctAt),
    })
  })

  return { questions, issues }
}

/**
 * Lifts a parsed question into the localised shape the module stores.
 *
 * An imported file is in one language, so the text goes to that locale and the
 * others fall back to it (§21.2) until someone translates them.
 */
export function toLocalizedQuestions(
  questions: ParsedQuestion[],
  locale: 'uz' | 'ru' | 'en',
): {
  key: string
  prompt: Localized
  options: { key: string; text: Localized }[]
  correctKey: string
}[] {
  const localize = (text: string): Localized =>
    locale === 'uz' ? { uz: text } : { uz: text, [locale]: text }

  return questions.map((question) => ({
    key: question.key,
    prompt: localize(question.prompt),
    options: question.options.map((option) => ({
      key: option.key,
      text: localize(option.text),
    })),
    correctKey: question.correctKey,
  }))
}
