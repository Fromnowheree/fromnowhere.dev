import type { CollectionConfig, TextFieldSingleValidation } from 'payload'

import { httpsRule } from '../fields/link'
import { slugify } from '../fields/slug'
import { l, pickLabel } from '../i18n/label'
import { MAX_LINK_LENGTH } from '../lib/content'
import { isShortAlias } from '../lib/shortLinks'

const aliasRule: TextFieldSingleValidation = (value, args) => {
  if (!value) return pickLabel(args.req?.i18n?.language, l('Enter a word.', 'Upišite riječ.'))
  if (isShortAlias(value)) return true
  return pickLabel(
    args.req?.i18n?.language,
    l(
      `"/${value}" can’t be a short link: it is taken by the site itself. Choose another word.`,
      `"/${value}" ne može biti kratka poveznica: zauzeo ju je sam web. Odaberite drugu riječ.`,
    ),
  )
}

/**
 * fromnowhere.dev/<word>, redirecting to a project: fromnowhere.dev/ygo, /giogio, /nmt. Answered
 * by src/app/(frontend)/pick-language/route.ts, where every address without a language arrives.
 */
export const ShortLinks: CollectionConfig = {
  slug: 'short-links',
  labels: {
    singular: l('Short link', 'Kratka poveznica'),
    plural: l('Short links', 'Kratke poveznice'),
  },
  admin: {
    group: l('Content', 'Sadržaj'),
    useAsTitle: 'alias',
    defaultColumns: ['alias', 'project', 'url'],
    description: l(
      'fromnowhere.dev/<word> sends visitors on to a project. Choose a project, or write an address.',
      'fromnowhere.dev/<riječ> šalje posjetitelje na projekt. Odaberite projekt ili upišite adresu.',
    ),
  },
  fields: [
    {
      name: 'alias',
      type: 'text',
      label: l('Word', 'Riječ'),
      required: true,
      unique: true,
      index: true,
      maxLength: 40,
      validate: aliasRule,
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? slugify(value) : value)],
      },
      admin: {
        description: l(
          'E.g. "giogio" for fromnowhere.dev/giogio.',
          'Npr. "giogio" za fromnowhere.dev/giogio.',
        ),
      },
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      label: l('Project', 'Projekt'),
      admin: {
        description: l(
          'Leads to the project’s first address, or to its page here while it has none.',
          'Vodi na prvu adresu projekta, ili na njegovu stranicu ovdje dok je nema.',
        ),
      },
    },
    {
      name: 'url',
      type: 'text',
      label: l('Or an address', 'Ili adresa'),
      maxLength: MAX_LINK_LENGTH,
      validate: ((value, args) => {
        const project = (args.siblingData as { project?: unknown }).project
        if (!value?.trim() && !project)
          return pickLabel(
            args.req?.i18n?.language,
            l('Choose a project or write an address.', 'Odaberite projekt ili upišite adresu.'),
          )
        return httpsRule(value, args)
      }) satisfies TextFieldSingleValidation,
      admin: {
        description: l(
          'Used instead of the project when filled in. Starts with https://.',
          'Koristi se umjesto projekta kad je upisana. Počinje s https://.',
        ),
      },
    },
  ],
}
