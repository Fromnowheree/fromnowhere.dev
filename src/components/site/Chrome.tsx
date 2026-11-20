import { getTranslations } from 'next-intl/server'

import { Mark } from '@/components/fnw'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { capabilitiesHref, displayAddress, notesHref, servicesHref } from '@/lib/links'
import { getPublishedIndex, getStudio } from '@/lib/payload'

/**
 * The header: the tile and FNW (the letters give way on a phone), Work, Services, Capabilities,
 * Notes and About (each only while there is something there; a phone keeps Services, or Work
 * while there are none, and the footer has the rest), the language pill and one action. Every
 * control is a 44px target. It is held still while pages change (`view-transition-name` in
 * site.css).
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, index] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getPublishedIndex(),
  ])
  return (
    <header className={index.services ? 'site-nav site-nav--offer wrap' : 'site-nav wrap'}>
      <Link className="fnw-nav__brand" href="/" aria-label={t('home')}>
        <Mark size={36} />
        <span className="site-nav__fnw">FNW</span>
      </Link>
      <nav className="site-nav__links" aria-label={t('main')}>
        <ul>
          <li className="site-nav__work">
            <Link href="/#projects">{t('projects')}</Link>
          </li>
          {index.services && (
            <li>
              <Link href={servicesHref}>{t('services')}</Link>
            </li>
          )}
          {index.capabilities && (
            <li className="site-nav__works">
              <Link href={capabilitiesHref}>{t('capabilities')}</Link>
            </li>
          )}
          {index.notes.size > 0 && (
            <li className="site-nav__notes">
              <Link href={notesHref}>{t('notes')}</Link>
            </li>
          )}
          {index.pages.has('about') && (
            <li className="site-nav__about">
              <Link href="/about">{t('about')}</Link>
            </li>
          )}
        </ul>
      </nav>
      <LanguageSwitch />
      <Link className="btn" href="/contact">
        {t('contact')}
      </Link>
    </header>
  )
}

/**
 * The footer: the mark and the name, the studio's address, its pages and its profiles elsewhere.
 * No attribution: this is where the attribution on every other site points. Links to Services,
 * Capabilities, Notes, About and Privacy appear only while there is something there.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const [t, tNav, studio, index] = await Promise.all([
    getTranslations({ locale, namespace: 'footer' }),
    getTranslations({ locale, namespace: 'nav' }),
    getStudio(locale),
    getPublishedIndex(),
  ])
  const profiles = studio.profiles ?? []
  return (
    <footer className="site-footer" aria-label={t('label')}>
      <div className="wrap site-footer__bar">
        <span className="site-footer__id">
          <Mark size={16} variant="mono" />
          Fromnowhere, {new Date().getFullYear()}
        </span>
        <ul className="site-footer__links">
          {studio.email && (
            <li>
              <a href={`mailto:${studio.email}`}>{studio.email}</a>
            </li>
          )}
          {profiles.map((profile) => (
            <li key={profile.id ?? profile.url}>
              <a
                href={profile.url}
                rel="me noopener noreferrer"
                title={displayAddress(profile.url)}
              >
                {profile.label}
              </a>
            </li>
          ))}
          {index.services && (
            <li>
              <Link href={servicesHref}>{tNav('services')}</Link>
            </li>
          )}
          {index.capabilities && (
            <li>
              <Link href={capabilitiesHref}>{tNav('capabilities')}</Link>
            </li>
          )}
          {index.notes.size > 0 && (
            <li>
              <Link href={notesHref}>{tNav('notes')}</Link>
            </li>
          )}
          {index.pages.has('about') && (
            <li>
              <Link href="/about">{tNav('about')}</Link>
            </li>
          )}
          {index.pages.has('privacy') && (
            <li>
              <Link href="/privacy">{t('privacy')}</Link>
            </li>
          )}
          <li>
            <Link href="/contact">{t('contact')}</Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
