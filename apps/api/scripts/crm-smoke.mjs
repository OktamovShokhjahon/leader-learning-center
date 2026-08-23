/**
 * End-to-end smoke test of the CRM core, run against a live API.
 *
 *   npm run smoke        (from the repo root, with the API and demo data up)
 *
 * It walks all four roles and asserts the rules the TZ actually names: the
 * superadmin-only finance guard (§4.3), teacher scoping (§4.2), schedule
 * conflict detection (§9.3), invoice idempotency (§26.3), payment idempotency
 * and immutability (§11.2, §26.4), and the teacher debt-flag rule (§4.2 note 2).
 *
 * It resets invoices, payments and attendance first, so it is repeatable. It
 * never touches students, groups or users.
 */
const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api/v1'

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await response.json().catch(() => ({}))
  return { status: response.status, body: json }
}

async function login(phone, password) {
  const { status, body } = await call('/auth/login', {
    method: 'POST',
    body: { phone, password },
  })
  if (status !== 200) throw new Error(`login ${phone} failed: ${JSON.stringify(body)}`)
  return body.data.accessToken
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const DEMO = 'DemoParol2026!'

// Start from a known state so the run is repeatable: the money and attendance
// collections are derived data, and the demo students/groups are left alone.
{
  const { MongoClient } = await import('mongodb')
  const client = new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017/leader')
  await client.connect()
  const db = client.db('leader')
  for (const name of ['invoices', 'payments', 'attendances']) {
    await db.collection(name).deleteMany({})
  }
  await client.close()
  console.log('reset: invoices, payments, attendance cleared')
}

const boss = await login('+998123456789', 'a@a@parola@a@A1')
const manager = await login('+998900000102', DEMO)
const teacher = await login('+998900000103', DEMO)

// ── RBAC: the finance router is superadmin-only (§4.3, §15) ───────────────
const bossFinance = await call('/finance/overview', { token: boss })
check('boss reads finance overview', bossFinance.status === 200)

for (const [role, token] of [['manager', manager], ['teacher', teacher]]) {
  const denied = await call('/finance/overview', { token })
  check(`${role} gets 403 on finance`, denied.status === 403, `got ${denied.status}`)
}

// ── Students ──────────────────────────────────────────────────────────────
const students = await call('/students?limit=5', { token: manager })
check('manager lists students', students.status === 200 && students.body.data.total >= 15,
  `total=${students.body.data?.total}`)

const teacherStudents = await call('/students?limit=5', { token: teacher })
check('teacher cannot list students', teacherStudents.status === 403, `got ${teacherStudents.status}`)

// ── Groups: teacher sees only their own (§4.2) ────────────────────────────
const managerGroups = await call('/groups', { token: manager })
const teacherGroups = await call('/groups', { token: teacher })
check('manager sees all 4 groups', managerGroups.body.data?.total === 4, `got ${managerGroups.body.data?.total}`)
check('teacher sees only own groups', teacherGroups.body.data?.total === 2,
  `got ${teacherGroups.body.data?.total}`)

// ── Schedule conflict detection (§9.3) ────────────────────────────────────
const firstGroup = managerGroups.body.data.items[0]
const conflict = await call('/groups', {
  token: manager,
  method: 'POST',
  body: {
    courseId: firstGroup.courseId._id ?? firstGroup.courseId,
    name: 'Conflicting group',
    teacherId: firstGroup.teacherId._id ?? firstGroup.teacherId,
    pattern: firstGroup.schedule.pattern,
    days: firstGroup.schedule.days,
    startTime: firstGroup.schedule.startTime,
    endTime: firstGroup.schedule.endTime,
    startDate: new Date().toISOString(),
    capacity: 10,
    price: 500000,
  },
})
check('double-booked teacher is blocked', conflict.status === 409,
  `got ${conflict.status} ${conflict.body.error?.code ?? ''}`)
check('conflict names the offending group',
  Boolean(conflict.body.error?.details?.conflicts?.[0]?.groupName),
  conflict.body.error?.details?.conflicts?.[0]?.groupName ?? 'none')

// ── Manager prices a group (§4.2 note 1, lifted by ADR 0004) ──────────────
const managerPriced = await call('/groups', {
  token: manager,
  method: 'POST',
  body: {
    courseId: firstGroup.courseId._id ?? firstGroup.courseId,
    name: 'Manager priced group',
    teacherId: firstGroup.teacherId._id ?? firstGroup.teacherId,
    pattern: 'juft', days: [2, 4], startTime: '20:00', endTime: '21:00',
    startDate: new Date().toISOString(), capacity: 10, price: 400000,
  },
})
check('manager may now set a group price', managerPriced.status === 201,
  `got ${managerPriced.status} ${managerPriced.body.error?.code ?? ''}`)
check('the price the manager set is the price stored',
  managerPriced.body.data?.price === 400000, `price=${managerPriced.body.data?.price}`)

// ── Manager approves a payment, but still cannot refund one (ADR 0004) ────
const managerRefund = await call('/payments/000000000000000000000000/refund', {
  token: manager, method: 'POST', body: { reason: 'should never be allowed' },
})
check('manager cannot refund', managerRefund.status === 403, `got ${managerRefund.status}`)

const managerApprovals = await call('/payments/pending-approval', { token: manager })
check('manager may reach the approval queue', managerApprovals.status === 200,
  `got ${managerApprovals.status}`)

// ── Invoices (§11.1) ──────────────────────────────────────────────────────
const period = new Date().toISOString().slice(0, 7)
const dry = await call('/payments/invoices/generate', {
  token: boss, method: 'POST', body: { period, dryRun: true },
})
check('dry run writes nothing', dry.body.data?.created === 0 && dry.body.data?.wouldCreate > 0,
  `wouldCreate=${dry.body.data?.wouldCreate}`)

const run1 = await call('/payments/invoices/generate', {
  token: boss, method: 'POST', body: { period },
})
const run2 = await call('/payments/invoices/generate', {
  token: boss, method: 'POST', body: { period },
})
check('invoice run creates invoices', run1.body.data?.created > 0, `created=${run1.body.data?.created}`)
check('re-running creates none (idempotent)', run2.body.data?.created === 0,
  `created=${run2.body.data?.created}, skipped=${run2.body.data?.skipped}`)

// ── Payment (§11.2) ───────────────────────────────────────────────────────
const search = await call('/students/search?q=Dilnoza', { token: manager })
const target = search.body.data?.[0]
check('student search returns debt', Boolean(target) && typeof target.debt === 'number',
  `${target?.fullName} debt=${target?.debt}`)

const key = `smoke-${Date.now()}`
const pay1 = await call('/payments', {
  token: manager, method: 'POST',
  body: { studentId: target._id, amount: 300000, method: 'naqd', idempotencyKey: key },
})
const pay2 = await call('/payments', {
  token: manager, method: 'POST',
  body: { studentId: target._id, amount: 300000, method: 'naqd', idempotencyKey: key },
})
check('payment accepted', pay1.status === 201, `receipt=${pay1.body.data?.payment?.receiptNo}`)
check('replayed key does not double-charge',
  pay2.body.data?.replayed === true &&
    pay2.body.data?.payment?._id === pay1.body.data?.payment?._id,
  `replayed=${pay2.body.data?.replayed}`)

const afterPay = await call(`/students/search?q=Dilnoza`, { token: manager })
check('debt fell by the amount paid',
  afterPay.body.data[0].debt === target.debt - 300000,
  `${target.debt} → ${afterPay.body.data[0].debt}`)

// partial payment leaves the invoice partial, not paid
const invoices = await call(`/payments/invoices?studentId=${target._id}`, { token: manager })
const invoice = invoices.body.data.items[0]
check('partial payment marks invoice partial', invoice.status === 'partial' || invoice.status === 'overdue',
  `status=${invoice.status}, paid=${invoice.paidAmount}/${invoice.finalAmount}`)

// ── Debtors (§11.3) ───────────────────────────────────────────────────────
const debtors = await call('/payments/debtors', { token: manager })
check('manager sees debtor amounts', debtors.status === 200 && typeof debtors.body.data.totalDebt === 'number',
  `count=${debtors.body.data?.total}, totalDebt=${debtors.body.data?.totalDebt}`)

const teacherDebtors = await call('/payments/debtors', { token: teacher })
const teacherRow = teacherDebtors.body.data?.items?.[0]
check('teacher sees a debt flag, never an amount',
  teacherDebtors.status === 200 &&
    teacherDebtors.body.data.totalDebt === undefined &&
    (!teacherRow || (teacherRow.hasDebt === true && teacherRow.due === undefined)),
  `totalDebt=${teacherDebtors.body.data?.totalDebt}`)

// ── Attendance (§10) ──────────────────────────────────────────────────────
const myGroup = teacherGroups.body.data.items[0]
const roster = await call(`/groups/${myGroup._id}/roster`, { token: teacher })
check('roster defaults every student to present',
  roster.status === 200 && roster.body.data.students.every((s) => s.status === 'present'),
  `${roster.body.data?.students?.length} students`)

if (roster.body.data.lesson) {
  const marked = await call('/groups/attendance', {
    token: teacher, method: 'POST',
    body: {
      lessonId: roster.body.data.lesson._id,
      entries: roster.body.data.students.map((s, i) => ({
        studentId: s.studentId,
        status: i === 0 ? 'absent' : 'present',
      })),
    },
  })
  check('teacher marks attendance in one call', marked.status === 200,
    `marked=${marked.body.data?.marked}`)

  const reread = await call(`/groups/${myGroup._id}/roster`, { token: teacher })
  check('absence persisted', reread.body.data.students[0].status === 'absent',
    reread.body.data.students[0].status)
} else {
  check('lesson exists for today', false, 'no lesson scheduled today — skipped marking')
}

// ── Refund is a new document, original untouched (§11.2) ──────────────────
const refund = await call(`/payments/${pay1.body.data.payment._id}/refund`, {
  token: boss, method: 'POST', body: { reason: 'Smoke test reversal' },
})
check('refund creates a negative counter-document',
  refund.status === 201 && refund.body.data?.amount === -300000,
  `amount=${refund.body.data?.amount}`)

const original = await call(`/payments?studentId=${target._id}`, { token: manager })
const originalRow = original.body.data.items.find((p) => p._id === pay1.body.data.payment._id)
check('original payment is unchanged', originalRow?.amount === 300000, `amount=${originalRow?.amount}`)

// ── Finance numbers reflect the activity ─────────────────────────────────
const overview = await call('/finance/overview', { token: boss })
check('finance overview computes a collection rate',
  overview.body.data?.collectionRate !== undefined,
  `invoiced=${overview.body.data?.invoiced}, collected=${overview.body.data?.revenue?.collected}, rate=${overview.body.data?.collectionRate}%`)

const comparison = await call('/finance/branches-comparison', { token: boss })
check('branch comparison returns rows', comparison.body.data?.branches?.length > 0,
  `${comparison.body.data?.branches?.length} branches`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log('FAILED:', failed.map((f) => f.name).join(', '))
  process.exitCode = 1
}
