/**
 * Builds the Uzbek user guide as a PDF.
 *
 *   node docs/qollanma/build.mjs
 *
 * Needs `pdfkit`, which is deliberately not a project dependency — this is a
 * documentation tool, not part of the app. Install it for the run and drop it
 * again:  npm install --no-save pdfkit
 *
 * The font is loaded from the system rather than bundled, because Uzbek Latin
 * needs `oʻ` and `gʻ` and the PDF standard fonts cannot render them. Arial has
 * the U+2018 the rest of this project writes those with.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { META, SECTIONS } from './content.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'leader-lc-qollanma.pdf')

/* ── Fonts ─────────────────────────────────────────────────────────────── */

const FONT_CANDIDATES = {
  regular: ['C:/Windows/Fonts/arial.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'],
  bold: ['C:/Windows/Fonts/arialbd.ttf', '/Library/Fonts/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'],
  italic: ['C:/Windows/Fonts/ariali.ttf', '/Library/Fonts/Arial Italic.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'],
}

function findFont(candidates) {
  const found = candidates.find((file) => fs.existsSync(file))
  if (!found) throw new Error(`No usable font found. Tried:\n  ${candidates.join('\n  ')}`)
  return found
}

/* ── Palette — the project's own colours (§25.2) ───────────────────────── */

const INK = '#16202B'
const SOFT = '#4A5A69'
const MUTED = '#7C8A97'
const NAVY = '#1F4E79'
const GLAZE = '#2F6F6B'
const CLAY = '#C7561F'
const RULE = '#DCE3E8'
const WARN_BG = '#FDF3E7'
const NOTE_BG = '#EDF4F4'

const PAGE = { margin: 56, width: 595.28, height: 841.89 }
const BODY_WIDTH = PAGE.width - PAGE.margin * 2

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: PAGE.margin, bottom: PAGE.margin + 24, left: PAGE.margin, right: PAGE.margin },
  bufferPages: true,
  info: {
    Title: `${META.title} — ${META.subtitle}`,
    Author: META.title,
    Subject: 'Foydalanuvchi qo‘llanmasi',
    Keywords: 'CRM, qo‘llanma, o‘zbek',
  },
})

doc.registerFont('body', findFont(FONT_CANDIDATES.regular))
doc.registerFont('bold', findFont(FONT_CANDIDATES.bold))
doc.registerFont('italic', findFont(FONT_CANDIDATES.italic))
doc.pipe(fs.createWriteStream(OUT))

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Starts a new page if `needed` points would overflow the text area. */
function ensure(needed) {
  const limit = PAGE.height - PAGE.margin - 40
  if (doc.y + needed > limit) doc.addPage()
}

function gap(points = 8) {
  doc.y += points
}

function rule() {
  ensure(12)
  doc
    .moveTo(PAGE.margin, doc.y)
    .lineTo(PAGE.width - PAGE.margin, doc.y)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke()
  gap(10)
}

function paragraph(text, options = {}) {
  const font = options.font ?? 'body'
  const size = options.size ?? 10
  doc.font(font).fontSize(size).fillColor(options.color ?? SOFT)
  const height = doc.heightOfString(text, { width: options.width ?? BODY_WIDTH, lineGap: 2.5 })
  ensure(height + 4)
  doc.text(text, options.x ?? PAGE.margin, doc.y, {
    width: options.width ?? BODY_WIDTH,
    lineGap: 2.5,
    align: options.align ?? 'left',
  })
  gap(options.after ?? 7)
}

function heading2(text) {
  ensure(46)
  gap(6)
  doc.font('bold').fontSize(15).fillColor(NAVY).text(text, PAGE.margin, doc.y, { width: BODY_WIDTH })
  gap(4)
  doc
    .moveTo(PAGE.margin, doc.y)
    .lineTo(PAGE.margin + 46, doc.y)
    .lineWidth(2.5)
    .strokeColor(CLAY)
    .stroke()
  gap(11)
}

function heading3(text) {
  ensure(32)
  gap(5)
  doc.font('bold').fontSize(11).fillColor(GLAZE).text(text, PAGE.margin, doc.y, { width: BODY_WIDTH })
  gap(6)
}

function bullets(items) {
  for (const item of items) {
    doc.font('body').fontSize(10).fillColor(SOFT)
    const height = doc.heightOfString(item, { width: BODY_WIDTH - 18, lineGap: 2.5 })
    ensure(height + 4)
    const top = doc.y
    doc.font('bold').fillColor(CLAY).text('•', PAGE.margin + 3, top, { width: 10 })
    doc.font('body').fillColor(SOFT).text(item, PAGE.margin + 18, top, {
      width: BODY_WIDTH - 18,
      lineGap: 2.5,
    })
    gap(5)
  }
  gap(3)
}

function steps(items) {
  for (const [index, item] of items.entries()) {
    doc.font('body').fontSize(10).fillColor(SOFT)
    const height = doc.heightOfString(item, { width: BODY_WIDTH - 26, lineGap: 2.5 })
    ensure(Math.max(height, 16) + 5)
    const top = doc.y

    // A numbered disc, so a reader can find their place mid-procedure.
    doc.circle(PAGE.margin + 8, top + 5.5, 8).fillColor(NAVY).fill()
    doc
      .font('bold')
      .fontSize(8)
      .fillColor('#FFFFFF')
      .text(String(index + 1), PAGE.margin, top + 2.5, { width: 16, align: 'center' })

    doc.font('body').fontSize(10).fillColor(SOFT).text(item, PAGE.margin + 26, top, {
      width: BODY_WIDTH - 26,
      lineGap: 2.5,
    })
    gap(7)
  }
  gap(3)
}

function callout(text, kind) {
  const isWarn = kind === 'warn'
  const bg = isWarn ? WARN_BG : NOTE_BG
  const accent = isWarn ? CLAY : GLAZE
  const label = isWarn ? 'DIQQAT' : 'ESLATMA'

  doc.font('body').fontSize(9.5)
  const inner = BODY_WIDTH - 26
  const textHeight = doc.heightOfString(text, { width: inner, lineGap: 2.5 })
  const boxHeight = textHeight + 30
  ensure(boxHeight + 8)

  const top = doc.y
  doc.roundedRect(PAGE.margin, top, BODY_WIDTH, boxHeight, 4).fillColor(bg).fill()
  doc.rect(PAGE.margin, top, 3, boxHeight).fillColor(accent).fill()

  doc
    .font('bold')
    .fontSize(7.5)
    .fillColor(accent)
    .text(label, PAGE.margin + 14, top + 9, { width: inner, characterSpacing: 0.8 })
  doc
    .font('body')
    .fontSize(9.5)
    .fillColor(INK)
    .text(text, PAGE.margin + 14, top + 21, { width: inner, lineGap: 2.5 })

  doc.y = top + boxHeight
  gap(10)
}

function code(text) {
  doc.font('bold').fontSize(10)
  const height = 26
  ensure(height + 8)
  const top = doc.y
  doc.roundedRect(PAGE.margin, top, BODY_WIDTH, height, 3).fillColor('#F1F5F7').fill()
  doc.fillColor(NAVY).text(text, PAGE.margin + 12, top + 8, { width: BODY_WIDTH - 24 })
  doc.y = top + height
  gap(10)
}

/**
 * A table that measures every row before drawing it, so a long cell wraps and a
 * row that will not fit moves to the next page whole rather than being cut.
 */
function table(head, rows) {
  const columns = head.length
  // The first column carries the label and gets more room; the rest share.
  const widths =
    columns === 2
      ? [BODY_WIDTH * 0.34, BODY_WIDTH * 0.66]
      : columns === 3
        ? [BODY_WIDTH * 0.26, BODY_WIDTH * 0.26, BODY_WIDTH * 0.48]
        : [BODY_WIDTH * 0.4, BODY_WIDTH * 0.2, BODY_WIDTH * 0.2, BODY_WIDTH * 0.2]

  const PAD = 7

  const rowHeight = (cells, font, size) => {
    doc.font(font).fontSize(size)
    return (
      Math.max(
        ...cells.map((cell, index) =>
          doc.heightOfString(String(cell), { width: widths[index] - PAD * 2, lineGap: 1.5 }),
        ),
      ) +
      PAD * 2
    )
  }

  const drawRow = (cells, { font, size, bg, color }) => {
    const height = rowHeight(cells, font, size)
    ensure(height + 2)
    const top = doc.y

    if (bg) doc.rect(PAGE.margin, top, BODY_WIDTH, height).fillColor(bg).fill()

    let x = PAGE.margin
    for (const [index, cell] of cells.entries()) {
      doc
        .font(font)
        .fontSize(size)
        .fillColor(color)
        .text(String(cell), x + PAD, top + PAD, { width: widths[index] - PAD * 2, lineGap: 1.5 })
      x += widths[index]
    }

    doc
      .moveTo(PAGE.margin, top + height)
      .lineTo(PAGE.width - PAGE.margin, top + height)
      .lineWidth(0.5)
      .strokeColor(RULE)
      .stroke()

    doc.y = top + height
  }

  drawRow(head, { font: 'bold', size: 8.5, bg: '#EAF0F3', color: NAVY })
  for (const [index, row] of rows.entries()) {
    drawRow(row, {
      font: 'body',
      size: 9,
      bg: index % 2 === 1 ? '#FAFCFD' : null,
      color: SOFT,
    })
  }
  gap(11)
}

/* ── Cover ─────────────────────────────────────────────────────────────── */

doc.rect(0, 0, PAGE.width, 250).fillColor(NAVY).fill()
doc.rect(0, 250, PAGE.width, 5).fillColor(CLAY).fill()

doc
  .font('bold')
  .fontSize(30)
  .fillColor('#FFFFFF')
  .text(META.title, PAGE.margin, 96, { width: BODY_WIDTH })
doc
  .font('body')
  .fontSize(13)
  .fillColor('#BFD4E4')
  .text(META.subtitle, PAGE.margin, 140, { width: BODY_WIDTH, lineGap: 3 })
doc
  .font('body')
  .fontSize(9.5)
  .fillColor('#8FB0C9')
  .text(META.version, PAGE.margin, 196, { width: BODY_WIDTH })

doc.y = 300
paragraph(META.note, { size: 10.5, color: SOFT })
gap(14)

heading3('Ushbu qo‘llanmada nima bor')
const toc = SECTIONS.map((section) => section.title)
bullets(toc)

gap(10)
callout(
  'Qo‘llanma tizimning hozirgi holatiga mos. Yangi imkoniyat qo‘shilsa, ' +
    'docs/qollanma/content.mjs faylini tahrirlab, qo‘llanmani qaytadan yig‘ing.',
  'note',
)

/* ── Sections ──────────────────────────────────────────────────────────── */

for (const section of SECTIONS) {
  doc.addPage()
  heading2(section.title)

  for (const block of section.blocks) {
    switch (block.t) {
      case 'p':
        paragraph(block.v)
        break
      case 'h2':
        heading2(block.v)
        break
      case 'h3':
        heading3(block.v)
        break
      case 'ul':
        bullets(block.v)
        break
      case 'steps':
        steps(block.v)
        break
      case 'table':
        table(block.head, block.rows)
        break
      case 'note':
        callout(block.v, 'note')
        break
      case 'warn':
        callout(block.v, 'warn')
        break
      case 'code':
        code(block.v)
        break
      default:
        throw new Error(`Unknown block type: ${block.t}`)
    }
  }
}

/* ── Footer on every page but the cover ────────────────────────────────── */

const range = doc.bufferedPageRange()
for (let index = range.start + 1; index < range.start + range.count; index += 1) {
  doc.switchToPage(index)
  // The footer sits below the text area, and pdfkit paginates anything written
  // past the bottom margin — which is how a footer loop silently doubled the
  // page count. Dropping the margin for the write keeps it on the page it
  // belongs to.
  doc.page.margins.bottom = 0
  const y = PAGE.height - PAGE.margin + 8
  doc
    .moveTo(PAGE.margin, y - 8)
    .lineTo(PAGE.width - PAGE.margin, y - 8)
    .lineWidth(0.5)
    .strokeColor(RULE)
    .stroke()
  doc
    .font('body')
    .fontSize(8)
    .fillColor(MUTED)
    .text(META.title, PAGE.margin, y, { width: BODY_WIDTH / 2, lineBreak: false })
  doc
    .font('body')
    .fontSize(8)
    .fillColor(MUTED)
    .text(String(index), PAGE.margin + BODY_WIDTH / 2, y, {
      width: BODY_WIDTH / 2,
      align: 'right',
      lineBreak: false,
    })
}

doc.end()
console.log(`Qo‘llanma tayyor: ${OUT}`)
