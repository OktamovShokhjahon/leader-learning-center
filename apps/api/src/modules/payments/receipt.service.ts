import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import { ApiError } from '@leader/shared/errors'
import { formatDdMmYyyy } from '@leader/shared/date'
import { Payment, Invoice } from './invoice.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course } from '../groups/group.model.js'
import { Branch } from '../branches/branch.model.js'

// `dejavu-fonts-ttf` has no package.json "exports" map, but resolving a raw
// subpath still needs a require-style lookup under ESM — hence the shim.
const require = createRequire(import.meta.url)
const DEJAVU_DIR = dirname(require.resolve('dejavu-fonts-ttf/package.json'))
const DEJAVU_REGULAR = join(DEJAVU_DIR, 'ttf', 'DejaVuSans.ttf')
const DEJAVU_BOLD = join(DEJAVU_DIR, 'ttf', 'DejaVuSans-Bold.ttf')

/**
 * A2 — the printable/downloadable receipt (chek). §25.2's Cyrillic requirement
 * applies here too: PDFKit's 14 standard fonts (Helvetica etc.) only cover
 * WinAnsi/Latin-1, so a student's Cyrillic name or a Uzbek ʻ/ʼ character would
 * render as boxes. DejaVu Sans (bundled via the `dejavu-fonts-ttf` package,
 * Bitstream Vera license, free to redistribute) covers Cyrillic, Latin
 * Extended-A/B and the Spacing Modifier Letters block in one TTF, so it is
 * registered as the document's only font instead.
 */
function localize(value: unknown, locale = 'uz'): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const record = value as Record<string, string | undefined>
  return record[locale] || record.uz || record.ru || record.en || ''
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString('uz-UZ')} so'm`
}

export async function streamReceiptPdf(paymentId: string, res: Response): Promise<void> {
  const payment = await Payment.findById(paymentId).lean()
  if (!payment) throw ApiError.notFound('Payment not found')

  const [student, invoice, branch] = await Promise.all([
    Student.findById(payment.studentId).select('fullName phone').lean(),
    payment.invoiceId ? Invoice.findById(payment.invoiceId).select('groupId period').lean() : null,
    Branch.findById(payment.branchId).select('name').lean(),
  ])

  let groupName = ''
  let courseName = ''
  if (invoice?.groupId) {
    const group = await Group.findById(invoice.groupId).select('name courseId').lean()
    groupName = group?.name ?? ''
    if (group?.courseId) {
      const course = await Course.findById(group.courseId).select('name').lean()
      courseName = localize(course?.name)
    }
  }

  const doc = new PDFDocument({ size: 'A5', margin: 40 })
  doc.registerFont('body', DEJAVU_REGULAR)
  doc.registerFont('bold', DEJAVU_BOLD)
  doc.font('body')

  const fileName = `chek-${payment.receiptNo ?? payment._id.toString()}.pdf`
  res.setHeader('content-type', 'application/pdf')
  res.setHeader('content-disposition', `inline; filename="${fileName}"`)
  doc.pipe(res)

  doc
    .font('bold')
    .fontSize(16)
    .text(localize(branch?.name) || 'Leader Learning Center', { align: 'center' })
  doc.font('body').fontSize(11).text("To'lov cheki / Receipt", { align: 'center' })
  doc.moveDown(1.2)

  const rows: [string, string][] = [
    ["Chek raqami", payment.receiptNo ?? payment._id.toString()],
    ['Sana', formatDdMmYyyy(payment.receivedAt)],
    ["To'lovchi", student?.fullName ?? ''],
    ['Telefon', student?.phone ?? ''],
    ...(courseName ? ([['Kurs', courseName]] as [string, string][]) : []),
    ...(groupName ? ([['Guruh', groupName]] as [string, string][]) : []),
    ...(invoice?.period ? ([['Davr', invoice.period]] as [string, string][]) : []),
    ["To'lov usuli", payment.method],
    ...(payment.note ? ([['Izoh', payment.note]] as [string, string][]) : []),
  ]

  const labelWidth = 130
  for (const [label, value] of rows) {
    const y = doc.y
    doc.font('bold').fontSize(11).text(`${label}:`, 40, y, { width: labelWidth })
    doc.font('body').fontSize(11).text(value, 40 + labelWidth, y, { width: 300 })
    doc.moveDown(0.4)
  }

  doc.moveDown(0.8)
  doc
    .font('bold')
    .fontSize(14)
    .text(`Summa: ${formatMoney(payment.amount)}`, { align: 'left' })

  if (payment.isRefund) {
    doc.moveDown(0.6)
    doc.font('bold').fontSize(11).fillColor('red').text('QAYTARILGAN TO\'LOV / REFUND', { align: 'center' })
    doc.fillColor('black')
  }

  doc.end()
}
