import type { Payload } from 'payload'

import type { CapabilityArea } from '../collections/Capabilities'
import { richText } from './lexical'

/**
 * What the studio offers, as the seed writes it: the services (what can be hired) and the
 * capabilities (what is under every line), in English and Croatian.
 *
 * Both are claims, so both name their proof, and the proof was checked against each project's own
 * repository when this was written: a capability lists a project only where that project's code
 * does what the sentence says, and `here` only where this site does. Change a sentence and its
 * proof together.
 */

type ServiceSeed = {
  slug: string
  /** The projects that prove it, by slug. */
  projects: string[]
  en: { name: string; summary: string; includes: string[] }
  hr: { name: string; summary: string; includes: string[] }
}

export const SERVICES: ServiceSeed[] = [
  {
    slug: 'websites',
    projects: ['giogio', 'gati'],
    en: {
      name: 'Websites with an editor',
      summary:
        'A site with a look of its own, in the languages it needs, and an editor its owner runs without help.',
      includes: [
        'A design made for the brief',
        'An editor for every page',
        'A contact form that keeps bots out without tracking anyone',
        'Share cards, a sitemap and structured data, so links and search results look right',
        'A move from an old site that keeps its addresses working',
      ],
    },
    hr: {
      name: 'Web stranice s uređivačem',
      summary:
        'Web s vlastitim izgledom, na jezicima koji mu trebaju, i uređivač kojim se vlasnik služi bez pomoći.',
      includes: [
        'Dizajn izrađen prema zadatku',
        'Uređivač za svaku stranicu',
        'Kontakt obrazac koji zaustavlja botove, a nikoga ne prati',
        'Kartice za dijeljenje, karta weba i strukturirani podaci, da poveznice i rezultati pretraživanja izgledaju kako treba',
        'Selidba sa starog weba uz adrese koje i dalje rade',
      ],
    },
  },
  {
    slug: 'products',
    projects: ['nmt'],
    en: {
      name: 'Products and web apps',
      summary:
        'Software people sign in to: the data, the admin and the pages around them, from the first sketch to a release.',
      includes: [
        'A product shaped with you: what it must do first, and what can wait',
        'An app on a real database, with roles, drafts and an API where one is needed',
        'On your own hardware, when the data must not leave the building',
        'Releases that bring their own database changes with them',
      ],
    },
    hr: {
      name: 'Proizvodi i web aplikacije',
      summary:
        'Softver u koji se ljudi prijavljuju: podaci, administracija i stranice oko njih, od prve skice do izdanja.',
      includes: [
        'Proizvod oblikovan zajedno s vama: što mora raditi odmah, a što može pričekati',
        'Aplikacija nad pravom bazom podataka, s ulogama, skicama i API-jem gdje je potreban',
        'Na vašoj opremi, kad podaci ne smiju napustiti zgradu',
        'Izdanja koja sa sobom donose vlastite izmjene baze',
      ],
    },
  },
  {
    slug: 'community',
    projects: ['locals'],
    en: {
      name: 'Community tools and bots',
      summary:
        'A home for a community, and the tools that run its events where its members already are.',
      includes: [
        'A site for events, seasons, results and photographs',
        'A Discord bot for signups, check-in, pairings and results',
        'The rules built in: pairings and tiebreakers follow the game’s own',
        'An event run from a phone, with no laptop at the desk',
      ],
    },
    hr: {
      name: 'Alati i botovi za zajednice',
      summary:
        'Dom za zajednicu i alati koji vode njezina događanja ondje gdje su joj članovi već okupljeni.',
      includes: [
        'Web za događanja, sezone, rezultate i fotografije',
        'Discord bot za prijave, dolaske, parove i rezultate',
        'Ugrađena pravila: parovi i kriteriji za izjednačene igrače prate pravila same igre',
        'Događanje koje se vodi s mobitela, bez prijenosnog računala za stolom',
      ],
    },
  },
  {
    slug: 'hosting',
    projects: ['gati'],
    en: {
      name: 'Hosting and care',
      summary: 'Your site on a server set up for it, with HTTPS, backups and updates looked after.',
      includes: [
        'Containers on a small server, with HTTPS that renews itself',
        'Backups every night, kept for thirty days',
        'Updates and security fixes applied, and the site checked after each',
        'Visitor statistics without cookies, when you want them',
      ],
    },
    hr: {
      name: 'Hosting i održavanje',
      summary:
        'Vaš web na poslužitelju postavljenom baš za njega, uz brigu o HTTPS-u, sigurnosnim kopijama i nadogradnjama.',
      includes: [
        'Kontejneri na malom poslužitelju, s HTTPS-om koji se sam obnavlja',
        'Sigurnosne kopije svake noći, čuvane trideset dana',
        'Nadogradnje i sigurnosni popravci, uz provjeru weba nakon svake izmjene',
        'Statistika posjeta bez kolačića, kad je želite',
      ],
    },
  },
]

type CapabilitySeed = {
  area: CapabilityArea
  /** In service on this site itself. */
  here: boolean
  /** The projects where the sentence is true today, by slug. */
  projects: string[]
  en: { title: string; text: string }
  hr: { title: string; text: string }
}

export const CAPABILITIES: CapabilitySeed[] = [
  {
    area: 'design',
    here: true,
    projects: ['locals'],
    en: {
      title: 'One design system, a look per site',
      text: 'Sites start from shared tokens and components and still look like nobody else: a tournament broadcast, a station at night.',
    },
    hr: {
      title: 'Jedan dizajnerski sustav, svakom webu svoj izgled',
      text: 'Webovi kreću od zajedničkih tokena i komponenti, a ipak ne nalikuju nijednom drugom: prijenos turnira, kolodvor noću.',
    },
  },
  {
    area: 'design',
    here: true,
    projects: ['locals', 'giogio', 'gati'],
    en: {
      title: 'Motion that knows when to stop',
      text: 'Animation is part of the design. For a visitor who asks for less motion, every page is still and fully drawn.',
    },
    hr: {
      title: 'Animacija koja zna stati',
      text: 'Animacija je dio dizajna. Posjetitelju koji traži manje kretanja svaka je stranica mirna i u cijelosti iscrtana.',
    },
  },
  {
    area: 'design',
    here: true,
    projects: ['giogio'],
    en: {
      title: 'Usable by everyone',
      text: 'A visible focus ring, targets a thumb can hit, and every page workable from the keyboard.',
    },
    hr: {
      title: 'Upotrebljivo za svakoga',
      text: 'Vidljiv okvir fokusa, mete koje palac može pogoditi i svaka stranica upotrebljiva s tipkovnice.',
    },
  },
  {
    area: 'build',
    here: true,
    projects: ['locals', 'giogio', 'gati'],
    en: {
      title: 'An editor in the same app',
      text: 'Next.js and Payload in one app: the owner signs in and edits the site in a browser, with no second system to keep alive.',
    },
    hr: {
      title: 'Uređivač u istoj aplikaciji',
      text: 'Next.js i Payload u jednoj aplikaciji: vlasnik se prijavi i uređuje web u pregledniku, bez drugog sustava koji treba održavati.',
    },
  },
  {
    area: 'build',
    here: true,
    projects: [],
    en: {
      title: 'Two languages, field by field',
      text: 'Every page’s address is the same in each language apart from the language itself, and each text is translated on its own; until it is, the page shows it in the first language.',
    },
    hr: {
      title: 'Dva jezika, polje po polje',
      text: 'Adresa svake stranice ista je na oba jezika, osim oznake jezika, a svaki se tekst prevodi zasebno; dok nije preveden, prikazuje se na prvom jeziku.',
    },
  },
  {
    area: 'build',
    here: true,
    projects: [],
    en: {
      title: 'Tested against the real thing',
      text: 'Integration tests run against a real Postgres on every change, and end-to-end tests drive a real browser through the site and its editor.',
    },
    hr: {
      title: 'Testirano na pravoj stvari',
      text: 'Integracijski testovi pri svakoj izmjeni rade nad pravim Postgresom, a testovi s kraja na kraj vode pravi preglednik kroz web i njegov uređivač.',
    },
  },
  {
    area: 'build',
    here: true,
    projects: ['gati'],
    en: {
      title: 'Readable by machines',
      text: 'Share cards drawn for each page, a sitemap and structured data, so a link or a search result shows the site as it is.',
    },
    hr: {
      title: 'Čitljivo strojevima',
      text: 'Kartice za dijeljenje nacrtane za svaku stranicu, karta weba i strukturirani podaci, da poveznica ili rezultat pretraživanja prikažu web kakav jest.',
    },
  },
  {
    area: 'security',
    here: true,
    projects: [],
    en: {
      title: 'A strict content security policy',
      text: 'Scripts run only with a key made for that one request, so a script someone manages to inject runs nothing.',
    },
    hr: {
      title: 'Stroga politika sigurnosti sadržaja',
      text: 'Skripte se izvršavaju samo s ključem izrađenim za taj jedan zahtjev, pa skripta koju netko uspije ubaciti ne izvršava ništa.',
    },
  },
  {
    area: 'security',
    here: true,
    projects: [],
    en: {
      title: 'A contact form that only relays',
      text: 'Nothing a visitor writes is stored or logged. A proof of work, a honeypot and rate limits hold bots off, with no third party watching.',
    },
    hr: {
      title: 'Kontakt obrazac koji samo prosljeđuje',
      text: 'Ništa što posjetitelj napiše ne sprema se i ne bilježi. Dokaz rada, skrivena zamka i ograničenja učestalosti zaustavljaju botove, bez treće strane koja promatra.',
    },
  },
  {
    area: 'security',
    here: true,
    projects: ['giogio', 'gati'],
    en: {
      title: 'An editor that stays shut',
      text: 'Failed sign-ins are limited. On this site the editor also answers only to allowed addresses, and its API reads nothing to a visitor.',
    },
    hr: {
      title: 'Uređivač koji ostaje zatvoren',
      text: 'Neuspjele prijave su ograničene. Na ovom webu uređivač k tome odgovara samo dopuštenim adresama, a njegov API posjetitelju ne čita ništa.',
    },
  },
  {
    area: 'security',
    here: true,
    projects: ['locals', 'gati'],
    en: {
      title: 'Containers with nothing extra',
      text: 'Every app runs as a user without root. This site’s container is also read-only, its image is built away from the server, and it signs in to its database with a role of its own.',
    },
    hr: {
      title: 'Kontejneri bez ičeg suvišnog',
      text: 'Svaka aplikacija radi kao korisnik bez administratorskih ovlasti. Kontejner ovog weba k tome je samo za čitanje, slika mu se izrađuje izvan poslužitelja, a u bazu se prijavljuje vlastitom ulogom.',
    },
  },
  {
    area: 'operations',
    here: true,
    projects: ['locals', 'gati'],
    en: {
      title: 'Hosted on a small server',
      text: 'Containers behind Caddy with HTTPS that renews itself, on a server small enough to be cheap and plain enough to understand.',
    },
    hr: {
      title: 'Na malom poslužitelju',
      text: 'Kontejneri iza Caddyja s HTTPS-om koji se sam obnavlja, na poslužitelju dovoljno malom da bude jeftin i dovoljno jednostavnom da bude razumljiv.',
    },
  },
  {
    area: 'operations',
    here: true,
    projects: [],
    en: {
      title: 'Encrypted backups, restores that fail safe',
      text: 'A backup is encrypted or it is not written, and a restore changes nothing until it is complete. Tests cover both.',
    },
    hr: {
      title: 'Šifrirane kopije, vraćanje bez štete',
      text: 'Sigurnosna kopija je šifrirana ili se ne zapisuje, a vraćanje ne mijenja ništa dok nije potpuno. Oboje pokrivaju testovi.',
    },
  },
  {
    area: 'operations',
    here: true,
    projects: [],
    en: {
      title: 'Database changes ship with the release',
      text: 'A new version applies its own migrations when it starts, and stops rather than run on a database it only half changed.',
    },
    hr: {
      title: 'Izmjene baze stižu s izdanjem',
      text: 'Nova verzija pri pokretanju sama primijeni svoje migracije, a radije stane nego da radi nad napola izmijenjenom bazom.',
    },
  },
  {
    area: 'operations',
    here: true,
    projects: [],
    en: {
      title: 'Every address checked',
      text: 'This site knocks on each project’s address every five minutes and says so on the board when one stops answering.',
    },
    hr: {
      title: 'Svaka adresa pod provjerom',
      text: 'Ovaj web svakih pet minuta pokuca na adresu svakog projekta i na ploči javi kad neka prestane odgovarati.',
    },
  },
  {
    area: 'operations',
    here: true,
    projects: ['gati'],
    en: {
      title: 'Statistics without cookies',
      text: 'When visits are counted, it is with Umami on the site’s own server: no cookies, no banner, nothing sent to anyone else.',
    },
    hr: {
      title: 'Statistika bez kolačića',
      text: 'Kad se posjeti broje, broje se Umamijem na vlastitom poslužitelju weba: bez kolačića, bez obavijesti i bez slanja ičega drugima.',
    },
  },
]

/**
 * The services and the capabilities, each when there are none at all (drafts included), so a
 * database seeded before they existed gets them too and an editor's own are never added to. A
 * project named as proof is looked up by slug; one that is not there is left out.
 */
export async function seedOffer(payload: Payload) {
  const { docs: projects } = await payload.find({
    collection: 'projects',
    depth: 0,
    limit: 99,
    pagination: false,
    overrideAccess: true,
    select: { slug: true },
  })
  const idOf = new Map(projects.map((project) => [project.slug, project.id]))
  const ids = (slugs: string[]) => slugs.flatMap((slug) => idOf.get(slug) ?? [])

  const services = await payload.count({ collection: 'services', overrideAccess: true })
  if (services.totalDocs === 0) {
    payload.logger.info('Seed: writing the services.')
    for (const [i, service] of SERVICES.entries()) {
      const created = await payload.create({
        collection: 'services',
        locale: 'en',
        data: {
          _status: 'published',
          slug: service.slug,
          order: i + 1,
          name: service.en.name,
          summary: service.en.summary,
          text: richText([{ ul: service.en.includes }]),
          projects: ids(service.projects),
        },
      })
      await payload.update({
        collection: 'services',
        id: created.id,
        locale: 'hr',
        data: {
          name: service.hr.name,
          summary: service.hr.summary,
          text: richText([{ ul: service.hr.includes }]),
        },
      })
    }
  }

  const capabilities = await payload.count({ collection: 'capabilities', overrideAccess: true })
  if (capabilities.totalDocs === 0) {
    payload.logger.info('Seed: writing the capabilities.')
    const placed = new Map<CapabilityArea, number>()
    for (const capability of CAPABILITIES) {
      const order = (placed.get(capability.area) ?? 0) + 1
      placed.set(capability.area, order)
      const created = await payload.create({
        collection: 'capabilities',
        locale: 'en',
        data: {
          _status: 'published',
          area: capability.area,
          order,
          onThisSite: capability.here,
          title: capability.en.title,
          text: capability.en.text,
          projects: ids(capability.projects),
        },
      })
      await payload.update({
        collection: 'capabilities',
        id: created.id,
        locale: 'hr',
        data: { title: capability.hr.title, text: capability.hr.text },
      })
    }
  }
}
