import { getTranslations } from 'next-intl/server'
import { Section, Eyebrow } from '@/components/ui/section'
import { LeadForm } from './lead-form'

/** TZ §6.2 §14 — inline short registration form; the full flow is its own page. */
export async function LeadFormSection() {
  const t = await getTranslations('home.form')

  return (
    <Section id="apply" className="relative overflow-hidden">
      <div className="container-site">
        <div className="grid items-center gap-10 rounded-card border border-border-subtle bg-surface p-6 shadow-raise md:p-10 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-5">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <h2 className="text-xl text-ink md:text-2xl dark:text-white">{t('title')}</h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-soft dark:text-navy-200">
              {t('subtitle')}
            </p>
            <div
              aria-hidden
              className="gradient-glaze mt-2 hidden h-40 rounded-card lg:block"
              style={{
                maskImage: 'linear-gradient(to bottom, black, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
              }}
            />
          </div>

          <LeadForm />
        </div>
      </div>
    </Section>
  )
}
