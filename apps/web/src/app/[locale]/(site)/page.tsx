import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@leader/shared/locales'
import { Hero } from '@/components/site/sections/hero'
import { TrustBar, Numbers } from '@/components/site/sections/trust-numbers'
import { CoursesSection } from '@/components/site/sections/courses'
import { WhySection, HowSection } from '@/components/site/sections/why-how'
import {
  ResultsSection,
  TeachersSection,
  TestimonialsSection,
} from '@/components/site/sections/people'
import { NewsSection } from '@/components/site/sections/news'
import { CabinetSection } from '@/components/site/sections/cabinet'
import { BranchesSection, FaqSection, FAQ_KEYS } from '@/components/site/sections/branches-faq'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, organizationJsonLd, faqJsonLd } from '@/lib/json-ld'

/** TZ §6.3 — ISR for all public pages. */
export const revalidate = 300

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const tf = await getTranslations('faqItems')
  const faqItems = FAQ_KEYS.map((key) => ({
    question: tf(`${key}.q`),
    answer: tf(`${key}.a`),
  }))

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={faqJsonLd(faqItems)} />

      {/* Section order is fixed by TZ §6.2 */}
      <Hero />
      <TrustBar />
      <Numbers />
      <CoursesSection limit={6} />
      <WhySection />
      <ResultsSection limit={8} />
      <TeachersSection limit={3} />
      <HowSection />
      <CabinetSection />
      <TestimonialsSection />
      <BranchesSection />
      <NewsSection limit={3} />
      <FaqSection />
      <LeadFormSection />
    </>
  )
}
