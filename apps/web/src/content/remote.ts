import 'server-only'
import type { Localized } from '@leader/shared/locales'
import { COURSES, type Course } from './courses'
import { TEACHERS, type Teacher } from './people'

/**
 * The public site's data, read from the API.
 *
 * §21.1 puts "Public site content" among the boss's settings, so the courses and
 * teacher cards a visitor sees are records the centre edits in the panel, not
 * constants in this repo. These read `GET /public/courses` and
 * `GET /public/teachers`, which are unauthenticated and deliberately narrow.
 *
 * **Every call falls back to the bundled content.** A marketing page that goes
 * blank because an API container is restarting is a worse failure than a page
 * showing last week's course list — and §30.13 asks for Lighthouse SEO 100,
 * which an empty page cannot reach. The fallback is also what makes the site
 * render before anyone has entered a single record.
 *
 * `server-only`: these run during render on the server, never in a bundle
 * shipped to a visitor.
 */

const REVALIDATE_SECONDS = 300

function apiBase(): string | null {
  // Server-side calls prefer API_URL; NEXT_PUBLIC_API_URL is the browser's copy
  // and is a reasonable second guess when only it is configured.
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  return base?.trim() ? base.replace(/\/+$/, '') : null
}

async function readPublic<T>(path: string): Promise<T[] | null> {
  const base = apiBase()
  if (!base) return null

  try {
    const response = await fetch(`${base}/api/v1/public/${path}`, {
      // Cached for five minutes: the landing page is the most-hit surface on the
      // site and a course list does not change between two visitors.
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { data?: T[] }
    // An empty collection is treated as "nothing entered yet", not as an answer,
    // so a fresh install still shows the seeded catalogue rather than a blank page.
    return Array.isArray(body.data) && body.data.length > 0 ? body.data : null
  } catch {
    return null
  }
}

/* ── Courses ──────────────────────────────────────────────────────────── */

type ApiCourse = {
  _id: string
  slug: string
  name: Localized
  description?: Localized
  level?: string
  durationMonths: number
  defaultPrice: number
  order: number
}

/**
 * The API's course shape carries less than the marketing card wants — there is
 * no tagline, age range or accent colour on a CRM course, because those are
 * presentation. Where the bundled entry for the same slug exists it supplies
 * them, so a course entered in the panel still renders as a designed card.
 */
function toCourse(row: ApiCourse): Course {
  const bundled = COURSES.find((course) => course.slug === row.slug)
  return {
    ...(bundled ?? COURSES[0]!),
    slug: row.slug,
    name: row.name,
    description: row.description ?? bundled?.description ?? row.name,
    tagline: bundled?.tagline ?? row.description ?? row.name,
    level: (row.level ? { uz: row.level } : bundled?.level) ?? row.name,
    durationMonths: row.durationMonths || (bundled?.durationMonths ?? 8),
    priceMonthly: row.defaultPrice || (bundled?.priceMonthly ?? 0),
    order: row.order ?? bundled?.order ?? 0,
    isPublic: true,
  }
}

export async function fetchCourses(): Promise<Course[]> {
  const rows = await readPublic<ApiCourse>('courses')
  if (!rows) return COURSES.filter((course) => course.isPublic).sort((a, b) => a.order - b.order)
  return rows.map(toCourse).sort((a, b) => a.order - b.order)
}

export async function fetchCourse(slug: string): Promise<Course | undefined> {
  return (await fetchCourses()).find((course) => course.slug === slug)
}

/* ── Teachers ─────────────────────────────────────────────────────────── */

type ApiTeacher = {
  _id: string
  slug: string
  fullName: string
  role: Localized
  bio?: Localized
  subjects: string[]
  certificates: string[]
  experienceYears: number
  photo?: string
  order: number
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const rows = await readPublic<ApiTeacher>('teachers')
  if (!rows) return [...TEACHERS].sort((a, b) => a.order - b.order)

  return rows
    .map((row) => ({
      slug: row.slug,
      fullName: row.fullName,
      role: row.role,
      bio: row.bio ?? row.role,
      subjects: row.subjects ?? [],
      certificates: row.certificates ?? [],
      experienceYears: row.experienceYears ?? 0,
      photo: row.photo ?? null,
      // Not exposed publicly — the endpoint deliberately omits branch ids so a
      // public face is never mapped onto an internal record.
      branchSlugs: [],
      order: row.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order)
}
