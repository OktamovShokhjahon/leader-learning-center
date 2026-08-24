/**
 * End-to-end smoke test of the whole API, run against a live server.
 *
 *   npm run smoke:full        (from the repo root, with the API and seed data up)
 *
 * `crm-smoke.mjs` covers the Phase 1–3 core. This one covers everything added
 * since — catalogue, settings, audit, leads, expenses, fines, payroll, the
 * branch switcher — and, more importantly, the *refusals*: each role is pointed
 * at every door it should not be able to open.
 *
 * It is read-mostly. Where it writes, it writes rows it can identify and clean
 * up afterwards, so it can be run repeatedly against the same database.
 */
const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api/v1'
const TAG = `smoke-${Date.now()}`

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  let json = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: response.status, body: json }
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  process.stdout.write(pass ? '.' : 'F')
}

/** Asserts an exact status, and reports what came back when it differs. */
async function expectStatus(name, expected, path, options = {}) {
  const { status, body } = await call(path, options)
  const ok = Array.isArray(expected) ? expected.includes(status) : status === expected
  check(
    name,
    ok,
    ok ? '' : `expected ${expected}, got ${status} ${JSON.stringify(body?.error ?? body).slice(0, 120)}`,
  )
  return body?.data
}

async function login(phone, password) {
  const { status, body } = await call('/auth/login', {
    method: 'POST',
    body: { phone, password },
  })
  if (status !== 200) throw new Error(`login ${phone} failed: ${JSON.stringify(body).slice(0, 200)}`)
  return body.data.accessToken
}

const DEMO = 'DemoParol2026!'

/* ── Run ───────────────────────────────────────────────────────────────── */

const boss = await login(
  process.env.SEED_SUPERADMIN_PHONE ?? '+998123456789',
  process.env.SEED_SUPERADMIN_PASSWORD ?? 'a@a@parola@a@A1',
)
const manager = await login('+998900000102', DEMO)
const teacher = await login('+998900000103', DEMO)
const student = await login('+998901000000', DEMO)

const asBoss = { token: boss }
const asManager = { token: manager }
const asTeacher = { token: teacher }
const asStudent = { token: student }

/* 1. Branch scope ------------------------------------------------------- */

await expectStatus('boss lists branches', 200, '/branches?limit=10', asBoss)

// Point the boss at the branch the demo staff actually work in. Picking the
// first branch off the list instead would silently test two different branches
// against each other — the manager would be refused ids the boss can see, which
// looks like a permission bug and is not one.
const me = await call('/auth/me', asManager)
const branchId = me.body?.data?.roles?.find((role) => role.branchId)?.branchId
if (!branchId) throw new Error('the demo manager has no branch — run `npm run seed` first')

await expectStatus('boss selects a branch', 200, '/auth/branch', {
  ...asBoss,
  method: 'POST',
  body: { branchId },
})

/* 2. Catalogue ---------------------------------------------------------- */

await expectStatus('boss reads courses', 200, '/courses?limit=5', asBoss)
await expectStatus('teacher reads courses', 200, '/courses?limit=5', asTeacher)
await expectStatus('boss reads rooms', 200, '/rooms', asBoss)

// §4.2 note 7 — a teacher's `content.manage` is for their own materials only.
await expectStatus('teacher cannot create a course', 403, '/courses', {
  ...asTeacher,
  method: 'POST',
  body: { name: { uz: 'Nope' }, slug: `${TAG}-nope` },
})
await expectStatus('manager cannot create a course', 403, '/courses', {
  ...asManager,
  method: 'POST',
  body: { name: { uz: 'Nope' }, slug: `${TAG}-nope2` },
})

const course = await expectStatus('boss creates a course', 201, '/courses', {
  ...asBoss,
  method: 'POST',
  body: { name: { uz: `${TAG} kurs` }, slug: `${TAG}-kurs`, defaultPrice: 500000 },
})
await expectStatus('boss renames the course', 200, `/courses/${course?._id}`, {
  ...asBoss,
  method: 'PATCH',
  body: { defaultPrice: 550000 },
})
await expectStatus('duplicate slug is refused', 409, '/courses', {
  ...asBoss,
  method: 'POST',
  body: { name: { uz: 'dup' }, slug: `${TAG}-kurs` },
})
await expectStatus('boss deletes the course', 200, `/courses/${course?._id}`, {
  ...asBoss,
  method: 'DELETE',
})

const room = await expectStatus('boss creates a room', 201, '/rooms', {
  ...asBoss,
  method: 'POST',
  body: { name: `${TAG}-xona`, capacity: 10 },
})
await expectStatus('boss deletes the room', 200, `/rooms/${room?._id}`, {
  ...asBoss,
  method: 'DELETE',
})

/* 3. Settings — superadmin only ----------------------------------------- */

await expectStatus('boss reads settings', 200, '/settings', asBoss)
await expectStatus('manager cannot read settings', 403, '/settings', asManager)
await expectStatus('teacher cannot read settings', 403, '/settings', asTeacher)

await expectStatus('boss writes a setting', 200, '/settings', {
  ...asBoss,
  method: 'PATCH',
  body: { key: 'money.overdueGraceDays', value: 4 },
})
await expectStatus('an out-of-range value is refused', 400, '/settings', {
  ...asBoss,
  method: 'PATCH',
  body: { key: 'money.discountCeilingPercent', value: 500 },
})
await expectStatus('an unknown key is refused', 400, '/settings', {
  ...asBoss,
  method: 'PATCH',
  body: { key: 'nope.nope', value: 1 },
})
await expectStatus('boss clears the override', 200, '/settings/money.overdueGraceDays', {
  ...asBoss,
  method: 'DELETE',
})

/* 4. Audit — superadmin only, and the setting write must be in it -------- */

const audit = await expectStatus('boss reads the audit log', 200, '/audit?limit=20', asBoss)
check(
  'the setting change is audited',
  (audit?.items ?? []).some((entry) => entry.action?.startsWith('setting.')),
  'no setting.* entry found',
)
await expectStatus('audit search by key works', 200, '/audit?search=overdueGrace', asBoss)
await expectStatus('manager cannot read the audit log', 403, '/audit', asManager)

/* 5. Leads — the manager's funnel ---------------------------------------- */

const leads = await expectStatus('manager lists leads', 200, '/leads?limit=10', asManager)
await expectStatus('manager reads the funnel', 200, '/leads/funnel', asManager)
await expectStatus('manager reads the sales report', 200, '/leads/report', asManager)
await expectStatus('teacher cannot read leads', 403, '/leads', asTeacher)

const openLead = (leads?.items ?? []).find((lead) => lead.status === 'yangi')
if (openLead) {
  await expectStatus('manager moves a lead', 200, `/leads/${openLead._id}`, {
    ...asManager,
    method: 'PATCH',
    body: { status: 'boglanildi' },
  })
  await expectStatus('a refusal without a reason is rejected', 400, `/leads/${openLead._id}`, {
    ...asManager,
    method: 'PATCH',
    body: { status: 'rad_etdi' },
  })
  await expectStatus('dragging into "became a student" is rejected', 400, `/leads/${openLead._id}`, {
    ...asManager,
    method: 'PATCH',
    body: { status: 'oquvchi_boldi' },
  })
  // Put it back so the script stays repeatable.
  await call(`/leads/${openLead._id}`, {
    ...asManager,
    method: 'PATCH',
    body: { status: 'yangi' },
  })
} else {
  check('a fresh lead exists to move', false, 'no lead in status "yangi"')
}

/* 6. Expenses ------------------------------------------------------------ */

const categories = await expectStatus('boss reads expense categories', 200, '/expenses/categories', asBoss)
const petty = (categories?.items ?? []).find((category) => category.petty)
const big = (categories?.items ?? []).find((category) => !category.petty && !category.payrollOnly)
const payrollOnly = (categories?.items ?? []).find((category) => category.payrollOnly)

if (petty && big && payrollOnly) {
  const small = await expectStatus('boss books a small expense', 201, '/expenses', {
    ...asBoss,
    method: 'POST',
    body: { amount: 12345, categoryId: petty._id, comment: TAG },
  })
  check('a small expense is booked straight away', small?.needsApproval === false, JSON.stringify(small?.expense?.status))

  const large = await expectStatus('an above-ceiling expense waits', 201, '/expenses', {
    ...asBoss,
    method: 'POST',
    body: { amount: 9_999_999, categoryId: big._id, comment: TAG },
  })
  check('it is queued for approval', large?.needsApproval === true, JSON.stringify(large?.expense?.status))

  await expectStatus('a hand-entered salary is refused', 400, '/expenses', {
    ...asBoss,
    method: 'POST',
    body: { amount: 1000, categoryId: payrollOnly._id },
  })

  await expectStatus('manager cannot book a non-petty category', 403, '/expenses', {
    ...asManager,
    method: 'POST',
    body: { amount: 1000, categoryId: big._id },
  })
  await expectStatus('manager cannot exceed the petty ceiling', 403, '/expenses', {
    ...asManager,
    method: 'POST',
    body: { amount: 5_000_000, categoryId: petty._id },
  })
  await expectStatus('manager can book petty cash', 201, '/expenses', {
    ...asManager,
    method: 'POST',
    body: { amount: 4321, categoryId: petty._id, comment: TAG },
  })

  await expectStatus('boss approves the queued expense', 200, `/expenses/${large?.expense?._id}/approve`, {
    ...asBoss,
    method: 'POST',
    body: {},
  })
  await expectStatus('a second decision is refused', 409, `/expenses/${large?.expense?._id}/reject`, {
    ...asBoss,
    method: 'POST',
    body: { reason: 'again' },
  })

  await expectStatus('boss reads the expense summary', 200, '/expenses/summary?groupBy=category', asBoss)
  await expectStatus('boss reads the monthly summary', 200, '/expenses/summary?groupBy=month', asBoss)

  // Clean up everything this run created.
  const mine = await call(`/expenses?limit=100`, asBoss)
  for (const row of mine.body?.data?.items ?? []) {
    if (row.comment === TAG) await call(`/expenses/${row._id}`, { ...asBoss, method: 'DELETE' })
  }
} else {
  check('expense categories are seeded', false, 'run `npm run seed`')
}

await expectStatus('teacher cannot read expenses', 403, '/expenses', asTeacher)

/* 7. Fines --------------------------------------------------------------- */

const fines = await expectStatus('boss lists fines', 200, '/fines?limit=10', asBoss)
await expectStatus('manager cannot list all fines', 403, '/fines', asManager)
await expectStatus('teacher sees their own fines', 200, '/fines?mine=true', asTeacher)
await expectStatus('student sees their own fines', 200, '/fines?mine=true', asStudent)

const students = await call('/students?limit=1', asBoss)
const someStudent = students.body?.data?.items?.[0]
if (someStudent) {
  const fine = await expectStatus('boss issues a fine', 201, '/fines', {
    ...asBoss,
    method: 'POST',
    body: {
      targetType: 'student',
      targetId: someStudent._id,
      amount: 15000,
      reason: `${TAG} sinov jarimasi uchun sabab`,
    },
  })
  await expectStatus('a too-short reason is refused', 400, '/fines', {
    ...asBoss,
    method: 'POST',
    body: { targetType: 'student', targetId: someStudent._id, amount: 1000, reason: 'kech' },
  })
  await expectStatus('manager cannot issue a fine', 403, '/fines', {
    ...asManager,
    method: 'POST',
    body: {
      targetType: 'student',
      targetId: someStudent._id,
      amount: 1000,
      reason: 'a long enough reason here',
    },
  })
  await expectStatus('boss cancels the fine', 200, `/fines/${fine?._id}/cancel`, {
    ...asBoss,
    method: 'POST',
    body: { reason: `${TAG} bekor` },
  })
  await expectStatus('cancelling twice is refused', 409, `/fines/${fine?._id}/cancel`, {
    ...asBoss,
    method: 'POST',
    body: { reason: 'again' },
  })
}

const appealed = (fines?.items ?? []).find((fine) => fine.status === 'appealed')
if (appealed) {
  await expectStatus('a teacher cannot decide their own appeal', 403, `/fines/${appealed._id}/appeal/decide`, {
    ...asTeacher,
    method: 'POST',
    body: { outcome: 'waived', reason: 'let me off' },
  })
}

/* 8. Fine rules and payroll — superadmin only ---------------------------- */

await expectStatus('boss reads fine rules', 200, '/fine-rules', asBoss)
await expectStatus('manager cannot read fine rules', 403, '/fine-rules', asManager)

await expectStatus('boss reads payroll', 200, '/payroll?limit=10', asBoss)
await expectStatus('manager cannot read payroll', 403, '/payroll', asManager)
await expectStatus('teacher cannot read payroll', 403, '/payroll', asTeacher)
await expectStatus('teacher reads their own payslip', 200, '/payroll/me', asTeacher)
await expectStatus('manager reads their own payslip', 200, '/payroll/me', asManager)
await expectStatus('boss reads salary schemes', 200, '/payroll/schemes', asBoss)

/* 9. Finance — the §4.3 hard guard --------------------------------------- */

await expectStatus('boss reads finance', 200, '/finance/overview', asBoss)
await expectStatus('manager is refused finance', 403, '/finance/overview', asManager)
await expectStatus('teacher is refused finance', 403, '/finance/revenue', asTeacher)
await expectStatus('student is refused finance', 403, '/finance/overview', asStudent)

/* 10. Students, groups, and the branch-scope guard ----------------------- */

await expectStatus('manager lists students', 200, '/students?limit=5', asManager)
await expectStatus('teacher cannot list students', 403, '/students', asTeacher)
await expectStatus('manager lists groups', 200, '/groups?limit=5', asManager)
await expectStatus('teacher lists their own groups', 200, '/groups?limit=5', asTeacher)
await expectStatus('boss reads the schedule', 200, '/groups/schedule/lessons?from=2026-01-01&to=2026-12-31', asBoss)

// §5.1 — writing from the consolidated scope must be refused.
await call('/auth/branch', { ...asBoss, method: 'POST', body: { branchId: 'ALL' } })
await expectStatus('a write from the ALL scope is refused', 400, '/students', {
  ...asBoss,
  method: 'POST',
  body: { fullName: `${TAG} student`, monthlyFee: 1000 },
})
await call('/auth/branch', { ...asBoss, method: 'POST', body: { branchId } })
const created = await expectStatus('and allowed once a branch is chosen', 201, '/students', {
  ...asBoss,
  method: 'POST',
  body: { fullName: `${TAG} student`, monthlyFee: 1000 },
})
if (created?._id) await call(`/students/${created._id}`, { ...asBoss, method: 'PATCH', body: { status: 'dropped', dropReason: 'other' } })

/* 11. Removed and unknown routes ---------------------------------------- */

await expectStatus('self-service password change is gone', 404, '/auth/password', {
  ...asBoss,
  method: 'POST',
  body: { currentPassword: 'x', newPassword: 'y', confirmPassword: 'y' },
})
await expectStatus('an unknown path returns the §23 envelope', 404, '/nope', asBoss)
await expectStatus('an anonymous request is refused', 401, '/students')

/* ── Report ────────────────────────────────────────────────────────────── */

const failed = results.filter((result) => !result.pass)
process.stdout.write('\n\n')
for (const result of results) {
  if (!result.pass) console.log(`  FAIL  ${result.name}\n        ${result.detail}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) process.exitCode = 1
