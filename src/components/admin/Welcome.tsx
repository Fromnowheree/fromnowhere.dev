import Link from 'next/link'
import type { ServerProps } from 'payload'

import { l, pickLabel } from '@/i18n/label'
import { readRelayConfig, relayReady } from '@/lib/relay/config'
import { serverUrl } from '@/lib/serverUrl'

const links = [
  { href: '/admin/collections/projects', label: l('Projects', 'Projekti') },
  { href: '/admin/collections/pages', label: l('Pages', 'Stranice') },
  { href: '/admin/collections/short-links', label: l('Short links', 'Kratke poveznice') },
  { href: '/admin/globals/studio', label: l('Studio', 'Studio') },
]

/** The dashboard greeting, in the editor's interface language. */
export async function Welcome({ user, i18n }: ServerProps) {
  const language = i18n?.language
  const say = (en: string, hr: string) => pickLabel(language, l(en, hr))
  // Umami dashboard (README: Visitor statistics). Follows STATS_DOMAIN, so the button only shows
  // while Caddy actually serves the dashboard.
  const statsDomain = process.env.STATS_DOMAIN?.trim()
  const statsUrl = statsDomain ? `https://${statsDomain}` : undefined
  const name = user && 'name' in user && user.name ? `, ${user.name}` : ''
  // The contact form sends only through its own mail account (src/lib/relay/config.ts); say
  // which, or why it is not shown, so nobody waits for messages that cannot arrive.
  const relay = relayReady() ? readRelayConfig() : null

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <h2 style={{ marginBottom: 'calc(var(--base) / 2)' }}>
        {say('Welcome', 'Dobro došli')}
        {name}
      </h2>
      <p style={{ marginBottom: 'calc(var(--base) / 2)' }}>
        {say(
          `Here you edit ${new URL(serverUrl).host}. Changes show as soon as you save.`,
          `Ovdje uređujete ${new URL(serverUrl).host}. Promjene su vidljive odmah nakon spremanja.`,
        )}
      </p>
      <p style={{ marginBottom: 'calc(var(--base) / 2)' }}>
        {relay
          ? say(
              `Contact form: messages are sent from ${relay.from} to ${relay.to}. The website keeps no copy.`,
              `Kontakt obrazac: poruke se šalju s ${relay.from} na ${relay.to}. Web ne čuva kopiju.`,
            )
          : say(
              "Contact form: switched off, because the form's mail account is not set up (CONTACT_SMTP_* in the server's .env). Visitors see the e-mail address instead.",
              'Kontakt obrazac: isključen, jer adresa za slanje poruka iz obrasca nije postavljena (CONTACT_SMTP_* u .env datoteci poslužitelja). Posjetitelji umjesto obrasca vide adresu e-pošte.',
            )}
      </p>
      <p style={{ display: 'flex', flexWrap: 'wrap', gap: 'calc(var(--base) / 2)' }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="btn btn--style-secondary btn--size-small"
          >
            {pickLabel(language, link.label)}
          </Link>
        ))}
        {statsUrl && (
          <a
            href={statsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--style-secondary btn--size-small"
          >
            {say('Visitor statistics', 'Statistika posjeta')} ↗
          </a>
        )}
        <a href="/" target="_blank" className="btn btn--style-primary btn--size-small">
          {say('View the site', 'Pogledaj stranicu')} ↗
        </a>
      </p>
    </div>
  )
}
