import { getTranslations } from 'next-intl/server'

import { Mark } from '@/components/fnw'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { displayAddress } from '@/lib/links'
import { getPublishedIndex, getStudio } from '@/lib/payload'

/** Tile + FNW, the primary lockup (design/logo.md). `full` adds FROMNOWHERE under the letters. */
export function Lockup({ size = 28, full = false }: { size?: number; full?: boolean }) {
  return (
    <span className="fnw-lockup" style={{ '--s': `${size}px` } as React.CSSProperties}>
      <Mark size={size} />
      {full ? (
        <span className="fnw-lockup__stack">
          <span className="fnw-lockup__fnw">FNW</span>
          <span className="fnw-lockup__name">Fromnowhere</span>
        </span>
      ) : (
        <span className="fnw-lockup__fnw">FNW</span>
      )}
    </span>
  )
}

/** The studio pattern's Nav (design/patterns.md): the 28px lockup, a few links, one action. */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, index] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getPublishedIndex(),
  ])
  return (
    <header className="fnw-nav site-nav wrap">
      <Link className="fnw-nav__brand" href="/" aria-label={t('home')}>
        <Lockup />
      </Link>
      <nav aria-label={t('main')}>
        <ul className="fnw-nav__links">
          <li>
            <Link href="/#projects">{t('projects')}</Link>
          </li>
          {index.pages.has('about') && (
            <li>
              <Link href="/about">{t('about')}</Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="fnw-nav__actions">
        <LanguageSwitch />
        <Link className="fnw-btn fnw-btn--primary" href="/contact">
          {t('contact')}
        </Link>
      </div>
    </header>
  )
}

/** The studio's own footer: the full lockup, the contact line, profiles. No attribution: this is
 * where the attribution on every other site points. */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const [t, studio, index] = await Promise.all([
    getTranslations({ locale, namespace: 'footer' }),
    getStudio(locale),
    getPublishedIndex(),
  ])
  const profiles = studio.profiles ?? []
  return (
    <footer className="fnw-footer site-footer wrap" aria-label={t('label')}>
      <div className="fnw-footer__main site-footer__id">
        <Lockup size={44} full />
        {studio.email && (
          <a className="site-footer__mail" href={`mailto:${studio.email}`}>
            {studio.email}
          </a>
        )}
      </div>
      <ul className="fnw-footer__links">
        {profiles.map((profile) => (
          <li key={profile.id ?? profile.url}>
            <a href={profile.url} rel="me noopener noreferrer" title={displayAddress(profile.url)}>
              {profile.label}
            </a>
          </li>
        ))}
        {index.pages.has('privacy') && (
          <li>
            <Link href="/privacy">{t('privacy')}</Link>
          </li>
        )}
      </ul>
    </footer>
  )
}
