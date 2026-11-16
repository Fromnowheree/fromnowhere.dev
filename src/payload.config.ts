import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { LinkFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { hr } from '@payloadcms/translations/languages/hr'
import path from 'path'
import { buildConfig } from 'payload'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Projects } from './collections/Projects'
import { ShortLinks } from './collections/ShortLinks'
import { StatusChecks } from './collections/StatusChecks'
import { Users } from './collections/Users'
import { richTextLinkRule } from './fields/link'
import { Studio } from './globals/Studio'
import { checkStatusTask } from './jobs/checkStatus'
import { defaultLocale, localeNames, locales } from './i18n/locales'
import { siteOrigins } from './lib/siteOrigins'
import { migrations } from './migrations'
import { seed } from './seed'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Without a host and a sender there is no mail; Payload then logs mail instead of sending it.
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM)

// Admin mail's transport (password resets). The adapter types this option as nodemailer's
// connection options, which since nodemailer 10 leave out `auth` (a login is the transport's
// business, not the connection's), yet it hands the object to `createTransport`, which reads it.
// Typed as the transport's options, so `auth` is checked rather than refused.
const adminTransport: SMTPTransport.Options = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  // STARTTLS or nothing: a reset link must not cross the network in clear text.
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' - Fromnowhere admin',
    },
    components: {
      beforeDashboard: ['/components/admin/Welcome#Welcome'],
    },
  },
  // The editor's own interface language: English or Croatian, from the browser or the user's
  // account settings. Independent of the content languages below.
  i18n: {
    supportedLanguages: { en, hr },
    fallbackLanguage: 'en',
  },
  // The content languages. Payload stores them as a Postgres enum, so the list is the schema's,
  // not a setting: a new one needs a migration. The site serves both. A field left empty in
  // Croatian shows the English.
  localization: {
    locales: locales.map((code) => ({ code, label: localeNames[code] })),
    defaultLocale,
    fallback: true,
  },
  collections: [Projects, Pages, ShortLinks, StatusChecks, Media, Users],
  globals: [Studio],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((feature) => feature.key !== 'link'),
      // A link in rich text follows the site's one link rule (src/lib/links.ts): Payload's own
      // check lets `javascript:` through. An internal link may name a page or a project; the
      // renderer (src/components/RichText.tsx) checks the rule again and drops the link, keeping
      // its words, when the target is not public.
      LinkFeature({
        enabledCollections: ['pages', 'projects'],
        fields: ({ defaultFields }) =>
          defaultFields.map((field) =>
            field.type === 'text' && !field.hasMany && field.name === 'url'
              ? { ...field, hasMany: false, validate: richTextLinkRule }
              : field,
          ),
      }),
    ],
  }),
  // The site reads its content through the Local API and the admin through REST; nothing needs
  // GraphQL, and an endpoint that is not there cannot be probed (/api/graphql answers 404).
  graphQL: { disable: true },
  // The session cookie counts only on requests from the site itself (src/lib/siteOrigins.ts).
  // Left empty, Payload would accept it from any origin, including the other *.fromnowhere.dev
  // sites.
  csrf: siteOrigins(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    migrationDir: path.resolve(dirname, 'migrations'),
    // Development pushes the schema straight into the database. Production never pushes: it
    // applies these migrations when the server starts (src/instrumentation.ts boots Payload before
    // the first request), so a new image brings its schema with it. Every schema change ships
    // with a migration of its own (AGENTS.md, "Migrations").
    prodMigrations: migrations,
  }),
  email: smtpConfigured
    ? nodemailerAdapter({
        // Admin mail (password resets). The contact form relay has a send-only account of its own.
        defaultFromAddress: process.env.SMTP_FROM!,
        defaultFromName: process.env.SMTP_FROM_NAME || 'Fromnowhere',
        transportOptions: adminTransport,
      })
    : undefined,
  // The status check (src/jobs/checkStatus.ts) is scheduled every 5 minutes on the `status` queue.
  // Every minute the server queues it when due and runs what is queued; that cron starts only
  // where Payload is booted with `cron: true` (src/instrumentation.ts, unless STATUS_CHECKS is
  // "off"), never in a build, a test or a script.
  jobs: {
    tasks: [checkStatusTask],
    autoRun: [{ cron: '0 * * * * *', queue: 'status', limit: 1 }],
    deleteJobOnComplete: true,
    access: {
      run: ({ req }) => Boolean(req.user),
      queue: ({ req }) => Boolean(req.user),
      cancel: ({ req }) => Boolean(req.user),
    },
  },
  sharp,
  onInit: async (payload) => {
    if (process.env.PAYLOAD_SEED === 'true') await seed(payload)
  },
})
