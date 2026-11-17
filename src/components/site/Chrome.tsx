import { getTranslations } from 'next-intl/server'

import { Mark } from '@/components/fnw'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { displayAddress, notesHref } from '@/lib/links'
import { getPublishedIndex, getStudio } from '@/lib/payload'

/**
 * The header: the tile and FNW (the letters give way on a phone), Projects, Notes and About, the
 * language pill and one action. Every control is a 44px target. It is held still while pages
 * change (`view-transition-name` in site.css).
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, index] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getPublishedIndex(),
  ])
  return (
    <header className="site-nav wrap">
      <Link className="fnw-nav__brand" href="/" aria-label={t('home')}>
        <Mark size={36} />
        <span className="site-nav__fnw">FNW</span>
      </Link>
      <nav className="site-nav__links" aria-label={t('main')}>
        <ul>
          <li>
            <Link href="/#projects">{t('projects')}</Link>
          </li>
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
 * No attribution: this is where the attribution on every other site points. Links to Notes, About
 * and Privacy appear only while there is something there.
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
