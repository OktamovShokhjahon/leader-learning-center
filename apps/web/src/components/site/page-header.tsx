import { Link } from '@/i18n/navigation'
import { ChevronRight } from 'lucide-react'

/**
 * Shared header for every inner page: the gradient band, the title, and a
 * breadcrumb trail whose JSON-LD counterpart is emitted by each page (§6.3).
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumb,
}: {
  title: string
  subtitle?: string
  breadcrumb?: { label: string; href?: string }[]
}) {
  return (
    <div className="relative overflow-hidden pt-18">
      <div aria-hidden className="gradient-glaze absolute inset-0" />
      <div aria-hidden className="tile-star absolute inset-0 text-white/[0.09]" />

      <div className="container-site relative py-14 md:py-20">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1.5 text-2xs text-white/65">
              {breadcrumb.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-white">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white/90">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <h1 className="display-section max-w-3xl text-white">{title}</h1>
        {subtitle ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
