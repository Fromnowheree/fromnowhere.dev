import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ContactForm } from '@/components/contact/ContactForm'
import { asLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedIndex, getStudio } from '@/lib/payload'
import { relayReady } from '@/lib/relay/config'
import { issueFormToken } from '@/lib/relay/fillTime'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const t = await getTranslations({ locale, namespace: 'contact' })
  return pageMetadata(locale, null, { title: t('title'), description: t('lead'), path: '/contact' })
}

/**
 * The contact page. The form shows only while it can send (the relay's mail account is set up);
 * otherwise, and without JavaScript, the plain address takes its place.
 */
export default async function ContactPage({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [t, tForm, studio, index] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'form' }),
    getStudio(locale),
    getPublishedIndex(),
  ])
  const formToken = relayReady() ? issueFormToken() : null

  return (
    <article className="contact">
      <header className="page-head">
        <h1 className="fnw-enter" style={{ '--i': 0 } as React.CSSProperties}>
          {t('title')}
        </h1>
        <p className="page-head__lead fnw-enter" style={{ '--i': 1 } as React.CSSProperties}>
          {t('lead')}
        </p>
      </header>

      {formToken ? (
        <>
          <noscript>
            <p className="fnw-muted">{tForm('needsScript')}</p>
            <style>{'.contact-form{display:none}'}</style>
          </noscript>
          <ContactForm
            formToken={formToken}
            privacyHref={index.pages.has('privacy') ? '/privacy' : null}
          />
        </>
      ) : (
        <p className="fnw-muted">{t('noForm')}</p>
      )}

      {studio.email && (
        <p className="contact__direct">
          {t('writeDirectly')} <a href={`mailto:${studio.email}`}>{studio.email}</a>
        </p>
      )}
    </article>
  )
}
