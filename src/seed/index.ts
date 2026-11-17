import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

import { richText } from './lexical'
import { WINDOWS, type WindowSeed } from './windowSeeds'

/**
 * Fills an EMPTY database with the site's starting content, in English and Croatian: the four
 * lines from the vision (docs/vision.html), their short links, the studio's words and the About
 * and privacy pages, and the first two notes (about the studio itself: with fewer than three
 * published, the notes stay hidden until a third is written). It never overwrites: if any project
 * exists, it does nothing.
 *
 * Statuses and addresses are the launch plan, not a promise: check them in the admin before
 * going live. NMT has no address yet, so its line is dashed and ends at its page here.
 *
 * Windows come from src/seed/windowSeeds.ts and the committed captures in src/seed/windows/
 * (`pnpm capture:windows`). A window is added only for a published destination, so the manifest
 * is empty until one is live, and an entry whose file is missing is skipped: nothing is invented.
 */

type ProjectSeed = {
  line: number
  name: string
  slug: string
  status: 'running' | 'building' | 'planned' | 'paused'
  kind: 'product' | 'community' | 'music' | 'client'
  addresses: { url: string; en?: string; hr?: string }[]
  stack: string[]
  en: { summary: string; story: string[] }
  hr: { summary: string; story: string[] }
  alias: string
}

/** The About and Privacy pages' starting words, in both languages. */
export const PAGES = [
  {
    slug: 'about',
    en: {
      title: 'About',
      lead: 'Fromnowhere is one person making software: sites, products and the parts that keep them running.',
      content: [
        'I build things for the web from start to finish: the idea, the design, the code, the server it runs on and the care it needs after launch. Fromnowhere is the name I build under, and this site is the station every project leaves from.',
        { h2: 'What I make' },
        'Sites with a character of their own: a tournament broadcast for a local Yu-Gi-Oh! scene, a collage, a paper trail and a playable album for one musician. Products that solve one problem properly, like a toolbox for clinics that keeps their records on their own premises. And sites for clients who want something they can run themselves.',
        { h2: 'How the work gets made' },
        'Every project here is built from one design system and one stack: Next.js and Payload on Postgres, served by Caddy. The same parts, arranged differently each time, so each site gets a look of its own without starting from nothing, and every one of them can be looked after by one person.',
        { h2: 'Working together' },
        'If you have something to build, write to me. I read every message and reply myself, and I say plainly whether I am the right person for it.',
      ],
    },
    hr: {
      title: 'O meni',
      lead: 'Fromnowhere je jedna osoba koja izrađuje softver: web stranice, proizvode i sve što ih drži u pogonu.',
      content: [
        'Izrađujem stvari za web od početka do kraja: ideju, dizajn, kod, poslužitelj na kojem rade i brigu koja im treba nakon objave. Fromnowhere je ime pod kojim radim, a ovaj web je stanica iz koje kreće svaki projekt.',
        { h2: 'Što izrađujem' },
        'Web stranice s vlastitim karakterom: prijenos turnira za lokalnu Yu-Gi-Oh! zajednicu, kolaž, papirnati trag i album koji se može igrati za jednog glazbenika. Proizvode koji jedan problem rješavaju kako treba, poput alata za ordinacije koji njihove podatke čuva u njihovim prostorima. I web stranice za klijente koji žele nešto čime mogu sami upravljati.',
        { h2: 'Kako nastaje rad' },
        'Svaki projekt ovdje izrađen je od jednog dizajnerskog sustava i jednog skupa alata: Next.js i Payload na Postgresu, koje poslužuje Caddy. Isti dijelovi, svaki put drukčije složeni, pa svaki web dobije vlastiti izgled bez kretanja od nule, a o svakom se može brinuti jedna osoba.',
        { h2: 'Suradnja' },
        'Ako imate nešto za izraditi, javite mi se. Čitam svaku poruku i odgovaram osobno, a iskreno ću reći jesam li prava osoba za taj posao.',
      ],
    },
  },
  {
    slug: 'privacy',
    en: {
      title: 'Privacy',
      lead: 'What this site keeps about you, which is very little.',
      content: [
        'The contact form sends your message straight to my inbox and keeps no copy on the server. I use what you wrote, and your address, only to reply. There are no cookies for visitors.',
        'The server writes no log of visits. To hold off spam, the contact form remembers the address a message came from for a short while, in memory only. If visitor statistics are switched on, they are counted with Umami on this server, without cookies or IP addresses, and deleted after 13 months.',
        'For anything about your data, write to hello@fromnowhere.dev.',
      ],
    },
    hr: {
      title: 'Privatnost',
      lead: 'Što ovaj web čuva o vama, a to je vrlo malo.',
      content: [
        'Kontakt obrazac šalje vašu poruku izravno u moj sandučić i ne čuva kopiju na poslužitelju. Ono što ste napisali i vašu adresu koristim samo za odgovor. Za posjetitelje nema kolačića.',
        'Poslužitelj ne vodi zapis o posjetima. Radi zaštite od neželjenih poruka kontakt obrazac kratko pamti adresu s koje je poruka stigla, samo u memoriji. Ako je statistika posjeta uključena, broji se Umamijem na ovom poslužitelju, bez kolačića i IP adresa, i briše nakon 13 mjeseci.',
        'Za sve u vezi s vašim podacima pišite na hello@fromnowhere.dev.',
      ],
    },
  },
]

const PROJECTS: ProjectSeed[] = [
  {
    line: 1,
    name: 'Locals',
    slug: 'locals',
    status: 'running',
    kind: 'community',
    addresses: [{ url: 'https://yugioh.fromnowhere.dev' }],
    stack: ['Next.js', 'Payload', 'discord.js', 'Postgres'],
    alias: 'ygo',
    en: {
      summary:
        'In-person Yu-Gi-Oh! events: seasons, standings, a gallery, and a Discord bot that runs the day.',
      story: [
        'A home for a local Yu-Gi-Oh! scene. The site is dressed as a tournament broadcast: lower thirds, slates and a results crawl.',
        'Behind it, a Discord bot takes signups, checks players in, pairs Swiss rounds and collects results, so the organisers run an event from their phones.',
      ],
    },
    hr: {
      summary:
        'Yu-Gi-Oh! turniri uživo: sezone, poredak, galerija i Discord bot koji vodi turnirski dan.',
      story: [
        'Dom lokalne Yu-Gi-Oh! zajednice. Web izgleda kao prijenos turnira: natpisi, najave i traka s rezultatima.',
        'Iza njega Discord bot prima prijave, bilježi dolaske, slaže švicarska kola i skuplja rezultate, pa organizatori vode turnir s mobitela.',
      ],
    },
  },
  {
    line: 2,
    name: 'Giogio',
    slug: 'giogio',
    status: 'running',
    kind: 'music',
    addresses: [
      { url: 'https://giogio.music' },
      { url: 'https://prod.giogio.music', en: 'Producer site', hr: 'Stranica producenta' },
      {
        url: 'https://presstart.giogio.music',
        en: 'Press Start, the album',
        hr: 'Press Start, album',
      },
    ],
    stack: ['Next.js', 'Payload', 'Cloudflare'],
    alias: 'giogio',
    en: {
      summary: 'An artist’s site, a producer’s site, and an album you can play as a pixel game.',
      story: [
        'Three sites for one musician, built on one shared design system.',
        'giogio.music is a collage and a diary: photocopy grain, a cassette J-card, torn sheets and gig posters. The producer site is a studio paper trail ending in a carbon-copy booking slip. Press Start turns an album into a small pixel game.',
      ],
    },
    hr: {
      summary: 'Stranica izvođača, stranica producenta i album koji se igra kao pikselna igra.',
      story: [
        'Tri weba za jednog glazbenika, izgrađena na jednom zajedničkom dizajnerskom sustavu.',
        'giogio.music je kolaž i dnevnik: zrnata fotokopija, omot kazete, poderani listovi i plakati koncerata. Stranica producenta je trag papira iz studija koji završava indigo listićem za rezervaciju. Press Start pretvara album u malu pikselnu igru.',
      ],
    },
  },
  {
    line: 3,
    name: 'Nowhere’s Medical Toolbox',
    slug: 'nmt',
    status: 'building',
    kind: 'product',
    addresses: [],
    stack: ['Next.js', 'Payload', 'FastAPI', 'Postgres', 'Podman'],
    alias: 'nmt',
    en: {
      summary:
        'An on-premise system for clinics: charts, a diary and patient records, plus a website product clinics can buy on its own.',
      story: [
        'A clinic system that runs on the clinic’s own hardware, so patient data never leaves the building.',
        'Its showcase at medical.fromnowhere.dev is still being built. Until then, this page is where its line ends.',
      ],
    },
    hr: {
      summary:
        'Sustav za ordinacije na vlastitom poslužitelju: kartoni, raspored i podaci o pacijentima, uz web stranicu koju ordinacije mogu kupiti i zasebno.',
      story: [
        'Sustav koji radi na opremi same ordinacije, pa podaci o pacijentima nikad ne napuštaju zgradu.',
        'Njegova stranica na medical.fromnowhere.dev još je u izradi. Do tada linija završava ovdje.',
      ],
    },
  },
  {
    line: 4,
    name: 'Gati',
    slug: 'gati',
    status: 'running',
    kind: 'client',
    addresses: [{ url: 'https://www.gati.hr' }],
    stack: ['Next.js', 'Payload', 'Postgres', 'Caddy'],
    alias: 'gati',
    en: {
      summary: 'Website and editor for a homeopathy practice in Varaždin.',
      story: [
        'A calm, Croatian-language site that replaced an old WordPress install, with an editor the owner uses on their own.',
      ],
    },
    hr: {
      summary: 'Web stranica i uređivač za homeopatsku praksu u Varaždinu.',
      story: [
        'Miran web na hrvatskom koji je zamijenio staru WordPress instalaciju, s uređivačem kojim se vlasnik služi sam.',
      ],
    },
  },
]

/**
 * The first notes, both about the studio itself and both true of the site as it launches. Two is
 * one short of opening the notes (src/lib/notes.ts): they appear once a third is published.
 */
export const NOTES = [
  {
    slug: 'every-line-reports-in',
    date: '2026-11-16T12:00:00.000Z',
    en: {
      title: 'Every line reports in now',
      summary:
        'The departures board checks each address every five minutes. A site that stops answering shows as Delayed until it’s back.',
      content: [
        'Until now the board showed what I told it: a line said Running because I had set it to Running. Now the site knocks on every address every five minutes and writes down whether anything answered.',
        'One missed knock is a blip and changes nothing. After two in a row, the line shows Delayed:',
        {
          ul: [
            'its trains stop where they are,',
            'its terminal and its status turn the colour of street light,',
            'the board says “Not answering just now”.',
          ],
        },
        'When the site answers again, the line runs again. Only lines I’ve marked as running can be delayed. A line under construction stays under construction, whatever its address does.',
      ],
    },
    hr: {
      title: 'Svaka linija se sada javlja',
      summary:
        'Ploča polazaka svakih pet minuta provjerava svaku adresu. Web koji se prestane javljati prikazuje se kao Kasni dok se ne vrati.',
      content: [
        'Dosad je ploča prikazivala ono što sam joj rekao: linija je pisala Radi zato što sam je tako označio. Sada web svakih pet minuta pokuca na svaku adresu i zapiše je li se itko javio.',
        'Jedno propušteno kucanje je slučajnost i ne mijenja ništa. Nakon dva zaredom linija se prikazuje kao Kasni:',
        {
          ul: [
            'njezini vlakovi stanu gdje jesu,',
            'njezina završna stanica i status poprime boju ulične rasvjete,',
            'ploča piše „Trenutačno ne odgovara”.',
          ],
        },
        'Kad se web ponovno javi, linija ponovno vozi. Kasniti mogu samo linije koje sam označio kao aktivne. Linija u izgradnji ostaje u izgradnji, što god njezina adresa radila.',
      ],
    },
  },
  {
    slug: 'links-arrive-with-a-map',
    date: '2026-11-16T12:00:00.000Z',
    en: {
      title: 'Links arrive with a map',
      summary:
        'Paste a project’s page into a chat and its preview draws the route map, with that project’s line lit.',
      content: [
        'Every page here has a share card: the picture a chat app shows under a link. Each one is drawn from the same geometry as the map on the home page, so a link to a project arrives as the map with that project’s line lit and the others dimmed.',
        'Chat apps keep these pictures for days, so a card shows the line as I set it, not the live status from the board.',
      ],
    },
    hr: {
      title: 'Poveznice stižu s kartom',
      summary:
        'Zalijepite stranicu projekta u razgovor i njezin pregled nacrta kartu linija, s osvijetljenom linijom tog projekta.',
      content: [
        'Svaka stranica ovdje ima karticu za dijeljenje: sliku koju aplikacija za razgovor prikaže ispod poveznice. Svaka je nacrtana iz iste geometrije kao karta na početnoj stranici, pa poveznica na projekt stiže kao karta na kojoj je linija tog projekta osvijetljena, a ostale prigušene.',
        'Aplikacije za razgovor te slike čuvaju danima, pa kartica prikazuje liniju onako kako sam je postavio, a ne trenutačni status s ploče.',
      ],
    },
  },
]

type SeedOptions = {
  /** Where the captures are. Resolved from the working directory, never from this module's own
   * address: the seed is bundled into .next/server/chunks, and the standalone server runs in /app. */
  windowsDir?: string
  /** The window manifest; tests pass a fixture. */
  windows?: WindowSeed[]
}

export async function seed(
  payload: Payload,
  {
    windowsDir = path.resolve(process.cwd(), 'src/seed/windows'),
    windows = WINDOWS,
  }: SeedOptions = {},
) {
  const { totalDocs } = await payload.count({ collection: 'projects', overrideAccess: true })
  if (totalDocs > 0) return
  payload.logger.info('Seed: filling an empty database with the starting content.')

  for (const project of PROJECTS) {
    const created = await payload.create({
      collection: 'projects',
      locale: 'en',
      data: {
        _status: 'published',
        name: project.name,
        slug: project.slug,
        line: project.line,
        status: project.status,
        kind: project.kind,
        stack: project.stack,
        summary: project.en.summary,
        story: richText(project.en.story),
        addresses: project.addresses.map((address) => ({ url: address.url, label: address.en })),
      },
    })
    await payload.update({
      collection: 'projects',
      id: created.id,
      locale: 'hr',
      data: {
        summary: project.hr.summary,
        story: richText(project.hr.story),
        // Array rows keep their ids, so only the localised label changes.
        addresses: (created.addresses ?? []).map((row, i) => ({
          ...row,
          label: project.addresses[i]?.hr,
        })),
      },
    })
    await payload.create({
      collection: 'short-links',
      data: { alias: project.alias, project: created.id },
    })

    const window = windows.find((entry) => entry.slug === project.slug)
    if (window) {
      const filePath = path.join(windowsDir, window.file)
      if (fs.existsSync(filePath)) {
        const media = await payload.create({
          collection: 'media',
          locale: 'en',
          data: { alt: window.alt.en, focalX: 50, focalY: 0 },
          filePath,
        })
        await payload.update({
          collection: 'media',
          id: media.id,
          locale: 'hr',
          data: { alt: window.alt.hr },
        })
        await payload.update({
          collection: 'projects',
          id: created.id,
          locale: 'en',
          data: {
            window: media.id,
            windowAddress: window.address,
            windowCaption: window.caption.en,
          },
        })
        await payload.update({
          collection: 'projects',
          id: created.id,
          locale: 'hr',
          data: { windowCaption: window.caption.hr },
        })
      } else {
        payload.logger.info(`Seed: no window for ${project.slug} (${window.file} not found).`)
      }
    }
  }

  await payload.updateGlobal({
    slug: 'studio',
    locale: 'en',
    data: {
      headline: 'Every project starts at the same point',
      email: 'hello@fromnowhere.dev',
      lede: 'Fromnowhere is a one-person software studio. Each line below leaves from here for something I’ve built: a site, a product, a community. Pick one and go.',
      defaultDescription:
        'Fromnowhere is an independent software studio: apps, developer websites and community sites.',
    },
  })
  await payload.updateGlobal({
    slug: 'studio',
    locale: 'hr',
    data: {
      headline: 'Svaki projekt kreće iz iste točke',
      lede: 'Fromnowhere je softverski studio jednog čovjeka. Svaka linija ispod kreće odavde prema nečemu što sam izradio: webu, proizvodu, zajednici. Odaberite jednu i krenite.',
      defaultDescription:
        'Fromnowhere je nezavisni softverski studio: aplikacije, web stranice i stranice zajednica.',
    },
  })

  for (const page of PAGES) {
    const created = await payload.create({
      collection: 'pages',
      locale: 'en',
      data: {
        _status: 'published',
        slug: page.slug,
        title: page.en.title,
        lead: page.en.lead,
        content: richText(page.en.content),
      },
    })
    await payload.update({
      collection: 'pages',
      id: created.id,
      locale: 'hr',
      data: { title: page.hr.title, lead: page.hr.lead, content: richText(page.hr.content) },
    })
  }

  // Oldest first: notes of the same day list newest-created first, so they read in NOTES' order.
  for (const note of [...NOTES].reverse()) {
    const created = await payload.create({
      collection: 'notes',
      locale: 'en',
      data: {
        _status: 'published',
        slug: note.slug,
        date: note.date,
        title: note.en.title,
        summary: note.en.summary,
        content: richText(note.en.content),
      },
    })
    await payload.update({
      collection: 'notes',
      id: created.id,
      locale: 'hr',
      data: { title: note.hr.title, summary: note.hr.summary, content: richText(note.hr.content) },
    })
  }

  payload.logger.info('Seed: done.')
}
