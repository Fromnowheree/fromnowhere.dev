import type { GlobalConfig } from 'payload'

import { httpsRule } from '../fields/link'
import { rowLabel } from '../fields/rowLabel'
import { signedIn } from '../access'
import { l } from '../i18n/label'
import { MAX_INTRO_LENGTH, MAX_LABEL_LENGTH, MAX_LINK_LENGTH } from '../lib/content'

/**
 * Everything about the studio that is not a project or a page: the home page's words, how to get
 * in touch, profiles elsewhere, search defaults and the statistics switch.
 */
export const Studio: GlobalConfig = {
  slug: 'studio',
  label: l('Studio', 'Studio'),
  admin: { group: l('Settings', 'Postavke') },
  // The editor's, over the API: the site reads it through the Local API (src/lib/payload.ts).
  access: { read: signedIn },
  versions: { max: 25 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: l('Home page', 'Početna'),
          fields: [
            {
              name: 'headline',
              type: 'text',
              label: l('Headline', 'Naslov'),
              localized: true,
              maxLength: 120,
              admin: {
                description: l(
                  'One sentence, at most about 22 characters a line. E.g. "Every project starts at the same point".',
                  'Jedna rečenica. Npr. "Svaki projekt kreće iz iste točke".',
                ),
              },
            },
            {
              name: 'lede',
              type: 'textarea',
              label: l('Under the headline', 'Ispod naslova'),
              localized: true,
              maxLength: 400,
            },
          ],
        },
        {
          label: l('Contact', 'Kontakt'),
          fields: [
            {
              name: 'email',
              type: 'email',
              label: l('E-mail address', 'Adresa e-pošte'),
              admin: {
                description: l(
                  'Shown on the contact page and in the footer, and given when the form cannot send.',
                  'Prikazuje se na stranici kontakta i u podnožju, i kad obrazac ne može poslati poruku.',
                ),
              },
            },
            {
              name: 'profiles',
              type: 'array',
              label: l('Profiles elsewhere', 'Profili drugdje'),
              labels: { singular: l('Profile', 'Profil'), plural: l('Profiles', 'Profili') },
              maxRows: 8,
              admin: rowLabel('label', l('Profile', 'Profil')),
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'label',
                      type: 'text',
                      label: l('Name', 'Naziv'),
                      required: true,
                      maxLength: MAX_LABEL_LENGTH,
                      admin: { width: '40%', description: l('E.g. GitHub', 'Npr. GitHub') },
                    },
                    {
                      name: 'url',
                      type: 'text',
                      label: l('Address', 'Adresa'),
                      required: true,
                      maxLength: MAX_LINK_LENGTH,
                      validate: httpsRule,
                      admin: { width: '60%' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: l('Search and statistics', 'Tražilice i statistika'),
          fields: [
            {
              name: 'defaultDescription',
              type: 'textarea',
              label: l('Description in search results', 'Opis u tražilicama'),
              localized: true,
              maxLength: MAX_INTRO_LENGTH,
              admin: {
                description: l(
                  'Used by any page without its own. Up to about 155 characters.',
                  'Koristi ga svaka stranica bez vlastitog. Do otprilike 155 znakova.',
                ),
              },
            },
            {
              name: 'googleSiteVerification',
              type: 'text',
              label: l('Google Search Console code', 'Kod za Google Search Console'),
              maxLength: 100,
            },
            {
              name: 'visitorStatistics',
              type: 'checkbox',
              label: l('Count visits (Umami)', 'Brojanje posjeta (Umami)'),
              defaultValue: false,
              admin: {
                description: l(
                  'Only works once the server has Umami set up (README, "Visitor statistics").',
                  'Radi tek kad je Umami postavljen na poslužitelju (README, "Visitor statistics").',
                ),
              },
            },
          ],
        },
      ],
    },
  ],
}
