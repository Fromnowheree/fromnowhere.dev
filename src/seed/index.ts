import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

import { richText } from './lexical'
import { seedOffer } from './offer'
import { WINDOWS, type WindowSeed } from './windowSeeds'

/**
 * Fills an EMPTY database with the site's starting content, in English and Croatian: the four
 * lines from the vision (docs/vision.html) with their case studies, their short links, the
 * studio's words and the About and privacy pages. It never overwrites: if any project exists, it
 * does nothing. The words are the studio's: "Fromnowhere" or "the studio", never "I" or "we", and
 * never how many people it is (AGENTS.md, "Voice").
 *
 * A case study says only what is true of the project's code as it is, and never that something
 * is live: the board's status does that, checked against the address itself. It names no private
 * person, and a client's case study, like a window, is published with the client's agreement:
 * ask before going live.
 *
 * The services and capabilities (src/seed/offer.ts) are a step of their own, like the notes:
 * written whenever there are none at all, so a database seeded before they existed gets them too.
 *
 * The first notes (NOTES) are a step of their own: they are written whenever there are no notes
 * at all, drafts included, so a database seeded before the notes existed gets them too. Once any
 * note exists, they are left alone; PAYLOAD_SEED goes back to false after the first start
 * (docs/launch.md), so deleting every note later does not bring them back.
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
  en: ProjectWords
  hr: ProjectWords
  alias: string
}

type Blocks = Parameters<typeof richText>[0]

/** A project's words in one language: the facts, and its case study's chapters. */
type ProjectWords = {
  summary: string
  client: string
  scope: string[]
  brief?: Blocks
  story: Blocks
  engineering?: Blocks
  outcome?: Blocks
}

/** A project's localised fields, as Payload takes them. */
const wordsOf = (words: ProjectWords) => ({
  summary: words.summary,
  client: words.client,
  scope: words.scope,
  story: richText(words.story),
  ...(words.brief ? { brief: richText(words.brief) } : {}),
  ...(words.engineering ? { engineering: richText(words.engineering) } : {}),
  ...(words.outcome ? { outcome: richText(words.outcome) } : {}),
})

/** The About and Privacy pages' starting words, in both languages. */
export const PAGES = [
  {
    slug: 'about',
    en: {
      title: 'About',
      lead: 'Fromnowhere is a software studio that takes a project from the first sketch to a server that stays up.',
      content: [
        'Fromnowhere builds for the web from start to finish: the idea, the design, the code, the server it runs on and the care it needs after launch. This site is the station every project leaves from.',
        { h2: 'What the studio makes' },
        'Sites with a character of their own: a tournament broadcast for a local Yu-Gi-Oh! scene, a collage, a paper trail and a playable album for one musician. Products that solve one problem properly, like a toolbox for clinics that keeps their records on their own premises. And sites for clients who want something they can run themselves.',
        { h2: 'How the work gets made' },
        'Most projects start from the same parts: Next.js and Payload, a Postgres database and Caddy in front, and where the look allows, one design system. The same parts, arranged differently each time, so each site gets a look of its own without starting from nothing, and what is learned on one line serves the next.',
        { h2: 'Working together' },
        'A project starts with a message. Say what you need in a few lines; the reply says plainly whether Fromnowhere is the right studio for it, what it would take and what happens next.',
      ],
    },
    hr: {
      title: 'O studiju',
      lead: 'Fromnowhere je softverski studio koji projekt vodi od prve skice do poslužitelja koji ostaje u pogonu.',
      content: [
        'Fromnowhere izrađuje softver za web od početka do kraja: od ideje, dizajna i koda do poslužitelja na kojem sve radi i brige koja je potrebna nakon objave. Ovaj web je stanica iz koje kreće svaki projekt.',
        { h2: 'Što studio izrađuje' },
        'Web stranice s vlastitim karakterom: prijenos turnira za lokalnu Yu-Gi-Oh! zajednicu te, za jednog glazbenika, kolaž, papirnati trag i album koji se može igrati. Proizvode koji jedan problem rješavaju kako treba, poput alata za ordinacije koji njihove podatke čuva u njihovim prostorima. I web stranice za klijente koji žele nešto čime mogu sami upravljati.',
        { h2: 'Kako nastaje rad' },
        'Većina projekata kreće od istih dijelova: Next.js-a i Payloada, baze Postgres i Caddyja ispred njih, a gdje izgled to dopušta i od istog dizajnerskog sustava. Isti dijelovi, svaki put drukčije složeni, pa svaki web dobije vlastiti izgled bez kretanja od nule, a ono što se nauči na jednoj liniji služi sljedećoj.',
        { h2: 'Suradnja' },
        'Projekt počinje porukom. Opišite što vam treba u nekoliko redaka; u odgovoru će jasno pisati je li Fromnowhere pravi studio za taj posao, što bi za njega trebalo i što slijedi.',
      ],
    },
  },
  {
    slug: 'privacy',
    en: {
      title: 'Privacy',
      lead: 'What this site keeps about you, which is very little.',
      content: [
        'The contact form sends your message straight to the studio’s inbox and keeps no copy on the server. What you wrote, and your address, are used only to reply. There are no cookies for visitors.',
        'The server writes no log of visits. To hold off spam, the contact form remembers the address a message came from for a short while, in memory only. If visitor statistics are switched on, they are counted with Umami on this server, without cookies or IP addresses, and deleted after 13 months.',
        'For anything about your data, write to hello@fromnowhere.dev.',
      ],
    },
    hr: {
      title: 'Privatnost',
      lead: 'Što ovaj web čuva o vama, a to je vrlo malo.',
      content: [
        'Kontakt obrazac šalje vašu poruku izravno u sandučić studija i ne čuva kopiju na poslužitelju. Ono što ste napisali i vaša adresa koriste se samo za odgovor. Za posjetitelje nema kolačića.',
        'Poslužitelj ne vodi zapis o posjetima. Radi zaštite od neželjenih poruka kontakt obrazac kratko pamti adresu s koje je poruka stigla, samo u memoriji. Ako je statistika posjeta uključena, broji se Umamijem na ovom poslužitelju, bez kolačića i IP adresa, i briše nakon 13 mjeseci.',
        'Za sve u vezi s vašim podacima pišite na hello@fromnowhere.dev.',
      ],
    },
  },
]

export const PROJECTS: ProjectSeed[] = [
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
      client: 'A local Yu-Gi-Oh! community',
      scope: ['Design', 'Website', 'Discord bot', 'Deployment'],
      brief: [
        'A scene that plays in person needed a home: one place for its events, seasons and results, and a way to run a tournament day from the Discord server its players already use.',
      ],
      story: [
        'The site is dressed as a tournament broadcast: lower thirds, numbered slates, a countdown to the next event and a results crawl. It carries the events, the seasons with their standings, a hall of fame, a photo gallery and a guide to a first event.',
        'Behind it, a Discord bot runs the day. It posts signups with a seat limit and a waitlist that moves up, checks players in, pairs Swiss rounds, takes results from the players themselves and posts the final standings. Organisers work from a staff-only desk channel on their phones: add a walk-in, approve a result, redo a pairing.',
      ],
      engineering: [
        {
          ul: [
            'Pairing follows the game’s own tournament rules: a random first round, then players on the same points, no rematch while one can be avoided, a bye for the lowest player who has not had one, and ties broken by opponents’ win rate.',
            'One module holds the pairing and the standings for both the bot and the site, so the table on an event’s page is the one the bot paired from.',
            'A result counts only once an organiser approves it, a table reported two ways is flagged, and a season’s table can rebuild itself from approved results.',
            'The bot never pings everyone, and changes to a tournament’s entries run one at a time, so two organisers pressing buttons at once cannot break a round.',
          ],
        },
      ],
      outcome: [
        'The site and the bot are one codebase, running as two processes on one database. Everything on its roadmap is built, and it deploys as containers beside this site.',
      ],
    },
    hr: {
      summary:
        'Yu-Gi-Oh! turniri uživo: sezone, poredak, galerija i Discord bot koji vodi turnirski dan.',
      client: 'Lokalna Yu-Gi-Oh! zajednica',
      scope: ['Dizajn', 'Web', 'Discord bot', 'Postavljanje'],
      brief: [
        'Zajednici koja igra uživo trebao je dom: jedno mjesto za turnire, sezone i rezultate te način da se turnirski dan vodi s Discord poslužitelja kojim se igrači već služe.',
      ],
      story: [
        'Web izgleda kao prijenos turnira: natpisi, numerirane najave, odbrojavanje do sljedećeg turnira i traka s rezultatima. Na njemu su turniri, sezone s poretkom, kuća slavnih, galerija fotografija i vodič za prvi turnir.',
        'Iza njega Discord bot vodi dan. Objavljuje prijave s ograničenim brojem mjesta i listom čekanja koja se sama pomiče, bilježi dolaske, slaže parove po švicarskom sustavu, prima rezultate od samih igrača i objavljuje konačni poredak. Organizatori rade s mobitela, u kanalu samo za osoblje: dodaju igrača koji je došao bez prijave, odobre rezultat, ponove parove.',
      ],
      engineering: [
        {
          ul: [
            'Parovi slijede turnirska pravila same igre: prvo kolo nasumično, zatim igrači s istim brojem bodova, bez ponovljenog susreta dok se može izbjeći, slobodno kolo za najniže plasiranog igrača koji ga još nije imao, a izjednačene igrače razdvaja postotak pobjeda njihovih protivnika.',
            'Jedan modul drži i parove i poredak, za bota i za web, pa je poredak na stranici turnira onaj iz kojeg je bot složio kolo.',
            'Rezultat vrijedi tek kad ga organizator odobri, stol prijavljen na dva načina se označi, a tablica sezone može se sama graditi iz odobrenih rezultata.',
            'Bot nikad ne proziva sve članove, a izmjene prijava na turniru izvode se jedna po jedna, pa dva organizatora koja istodobno pritisnu gumb ne mogu pokvariti kolo.',
          ],
        },
      ],
      outcome: [
        'Web i bot jedan su kod koji radi kao dva procesa nad jednom bazom. Sve s njegova plana je izrađeno, a postavlja se u kontejnerima uz ovaj web.',
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
      client: 'A musician and producer',
      scope: ['Design system', 'Three websites', 'Editor', 'Pixel game'],
      brief: [
        'One musician, three audiences: listeners, people who book studio time, and anyone curious about one album. Each needed a site with a mood of its own, and all three had to read as the same person.',
      ],
      story: [
        'giogio.music is a collage and a diary: the newest release fills the first screen in its own colour, releases come as cassette J-cards, and a diary runs notes, release days and shows together, the shows drawn as gig posters.',
        'The producer site is a studio paper trail: a session sheet, a reel that plays from a cassette, credits as a tape-box track sheet, a rate card, and a booking form shaped as a carbon-copy slip.',
        'Press Start presents an album as a console menu from the nineties: the album is a game and each track a level, played with a keyboard, a gamepad or a thumb.',
      ],
      engineering: [
        {
          ul: [
            'All three share one brand package of tokens, components, textures and logos, so a colour changed once changes everywhere.',
            'Press Start’s pixel art is drawn in code on a small framebuffer and scaled up, thirty frames a second, with a visualiser that follows the music.',
            'The artist edits releases, shows, credits and the diary in an editor whose dashboard lists every field still empty.',
            'The sites are built for Cloudflare Workers; the booking form is checked on the server and carries a honeypot against bots.',
          ],
        },
      ],
      outcome: [
        'All three sites are built: the artist’s and the producer’s as one app with the editor, the album as a static site of its own.',
      ],
    },
    hr: {
      summary: 'Stranica izvođača, stranica producenta i album koji se igra kao pikselna igra.',
      client: 'Glazbenik i producent',
      scope: ['Dizajnerski sustav', 'Tri weba', 'Uređivač', 'Pikselna igra'],
      brief: [
        'Jedan glazbenik, tri publike: slušatelji, oni koji rezerviraju studio i svi koje zanima jedan album. Svakoj je trebao web s vlastitim ugođajem, a sva tri morala su se čitati kao ista osoba.',
      ],
      story: [
        'giogio.music je kolaž i dnevnik: najnovije izdanje ispunjava prvi zaslon u vlastitoj boji, izdanja su omoti kazeta, a dnevnik spaja bilješke, dane izdanja i nastupe, pri čemu su nastupi nacrtani kao koncertni plakati.',
        'Stranica producenta je trag papira iz studija: list sesije, snimke koje sviraju s kazete, zasluge kao popis na kutiji vrpce, cjenik i obrazac za rezervaciju u obliku indigo listića.',
        'Press Start predstavlja album kao izbornik konzole iz devedesetih: album je igra, a svaka pjesma razina, i igra se tipkovnicom, kontrolerom ili palcem.',
      ],
      engineering: [
        {
          ul: [
            'Sva tri weba dijele jedan paket s tokenima, komponentama, teksturama i logotipima, pa se boja promijenjena na jednom mjestu mijenja svugdje.',
            'Pikselna grafika Press Starta crta se kodom na malom međuspremniku slike i uvećava, trideset sličica u sekundi, uz vizualizaciju koja prati glazbu.',
            'Izvođač uređuje izdanja, nastupe, zasluge i dnevnik u uređivaču čija početna ploča navodi svako još prazno polje.',
            'Webovi su izrađeni za Cloudflare Workers; obrazac za rezervaciju provjerava se na poslužitelju i ima skrivenu zamku za botove.',
          ],
        },
      ],
      outcome: [
        'Sva tri weba su izrađena: izvođačev i producentov kao jedna aplikacija s uređivačem, a album kao zaseban statički web.',
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
      client: 'Clinics',
      scope: ['Product', 'Design', 'Build'],
      brief: [
        'A clinic holds some of the most private records there are. This system is for the clinic that would rather keep them in the building.',
      ],
      story: [
        'A clinic system that runs on the clinic’s own hardware, so patient data never leaves the building.',
      ],
      outcome: [
        'Its showcase at medical.fromnowhere.dev is still being built. Until then, this page is where its line ends.',
      ],
    },
    hr: {
      summary:
        'Sustav za ordinacije na vlastitom poslužitelju: kartoni, raspored i podaci o pacijentima, uz web stranicu koju ordinacije mogu kupiti i zasebno.',
      client: 'Ordinacije',
      scope: ['Proizvod', 'Dizajn', 'Izrada'],
      brief: [
        'Ordinacija čuva neke od najosjetljivijih podataka koji postoje. Ovaj je sustav za ordinaciju koja ih radije čuva u vlastitoj zgradi.',
      ],
      story: [
        'Sustav koji radi na opremi same ordinacije, pa podaci o pacijentima nikad ne napuštaju zgradu.',
      ],
      outcome: [
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
      client: 'A homeopathy practice in Varaždin',
      scope: ['Design', 'Website', 'Editor', 'Move from WordPress', 'Hosting'],
      brief: [
        'The practice’s site ran on an old WordPress install with a page builder. It needed a calm site in Croatian that its owner could keep up to date alone, without losing the addresses that visitors and search engines already knew.',
      ],
      story: [
        'A new site at the old addresses: the practice, its services with a page each, a guide to a first visit, a gallery, questions and answers, and a contact form.',
        'The owner runs it from the editor: writes every page, adds a service, reads inquiries and marks them answered, puts up a dated notice that takes itself down, and goes back to an earlier version when needed.',
      ],
      engineering: [
        {
          ul: [
            'Old addresses keep working: pages kept their addresses or lead permanently to their new one, and the ones WordPress had made on its own lead permanently to the right place.',
            'The old site’s texts, lightly edited, and its photographs are loaded on the first start, so the editor opens on a full site.',
            'An inquiry is saved before it is mailed, so a mail failure loses nothing; a honeypot and a limit per address keep bots out.',
            'No cookie banner, because nothing needs one: statistics are self-hosted and cookieless, and the map loads only when a visitor asks for it.',
          ],
        },
      ],
      outcome: [
        'It is built to run in containers on a small server, behind HTTPS that renews itself, with a backup script that keeps thirty days of nightly copies.',
      ],
    },
    hr: {
      summary: 'Web stranica i uređivač za homeopatsku praksu u Varaždinu.',
      client: 'Homeopatska praksa u Varaždinu',
      scope: ['Dizajn', 'Web', 'Uređivač', 'Selidba s WordPressa', 'Hosting'],
      brief: [
        'Web prakse radio je na staroj WordPress instalaciji s alatom za slaganje stranica. Trebao joj je miran web na hrvatskom koji vlasnik može sam održavati, a da se ne izgube adrese koje posjetitelji i tražilice već poznaju.',
      ],
      story: [
        'Novi web na starim adresama: o praksi, usluge sa zasebnom stranicom za svaku, vodič za prvi posjet, galerija, pitanja i odgovori te kontakt obrazac.',
        'Vlasnik ga vodi iz uređivača: piše svaku stranicu, dodaje uslugu, čita upite i označava na koje je odgovoreno, postavlja obavijest s datumom koja se sama ukloni i po potrebi vraća raniju verziju.',
      ],
      engineering: [
        {
          ul: [
            'Stare adrese i dalje rade: stranice su zadržale svoje adrese ili trajno vode na novu, a one koje je WordPress sam stvarao trajno vode na pravo mjesto.',
            'Tekstovi starog weba, uz manje ispravke, i njegove fotografije učitavaju se pri prvom pokretanju, pa uređivač ne počinje od praznog weba.',
            'Upit se sprema prije nego što se pošalje e-poštom, pa se ni pri kvaru pošte ništa ne gubi; skrivena zamka i ograničenje po adresi drže botove podalje.',
            'Nema obavijesti o kolačićima jer nijedan nije potreban: statistika je na vlastitom poslužitelju i bez kolačića, a karta se učitava tek kad je posjetitelj zatraži.',
          ],
        },
      ],
      outcome: [
        'Izrađen je za rad u kontejnerima na malom poslužitelju, iza HTTPS-a koji se sam obnavlja, uz skriptu koja noćne sigurnosne kopije čuva trideset dana.',
      ],
    },
  },
]

/**
 * The first notes, all about the studio itself and all true of the site as it launches: three,
 * the number that opens the notes (src/lib/notes.ts). Newest first.
 */
export const NOTES = [
  {
    slug: 'notes-are-open',
    date: '2026-11-17T12:00:00.000Z',
    en: {
      title: 'Notes are open',
      summary:
        'Short, dated notes on what the studio is building have a page of their own now, and the newest three wait under the departures board.',
      content: [
        'Each note belongs to the line of the project it is about and wears that line’s colour, on the notes page, under the board and on the project’s own page. A note like this one, about the studio itself, wears the point.',
        'Notes stay hidden until there are at least three, so the page never opens nearly empty. This is the third.',
      ],
    },
    hr: {
      title: 'Bilješke su otvorene',
      summary:
        'Kratke bilješke s datumom o onome što studio izrađuje sada imaju svoju stranicu, a najnovije tri čekaju ispod ploče polazaka.',
      content: [
        'Svaka bilješka pripada liniji projekta o kojem govori i nosi boju te linije, na stranici bilježaka, ispod ploče i na stranici samog projekta. Bilješka poput ove, o samom studiju, nosi točku.',
        'Bilješke su skrivene dok ih nema barem tri, pa se stranica nikad ne otvara gotovo prazna. Ovo je treća.',
      ],
    },
  },
  {
    slug: 'every-line-reports-in',
    date: '2026-11-16T12:00:00.000Z',
    en: {
      title: 'Every line reports in now',
      summary:
        'The departures board checks each address every five minutes. A site that stops answering shows as Delayed until it’s back.',
      content: [
        'Until now the board showed what it was told: a line said Running because it had been set to Running. Now the site knocks on every address every five minutes and writes down whether anything answered.',
        'One missed knock is a blip and changes nothing. After two in a row, the line shows Delayed:',
        {
          ul: [
            'its trains stop where they are,',
            'its terminal and its status turn the colour of street light,',
            'the board says “Not answering just now”.',
          ],
        },
        'When the site answers again, the line runs again. Only lines marked as running can be delayed. A line under construction stays under construction, whatever its address does.',
      ],
    },
    hr: {
      title: 'Svaka linija se sada javlja',
      summary:
        'Ploča polazaka svakih pet minuta provjerava svaku adresu. Web koji se prestane javljati prikazuje se kao Kasni dok se ne vrati.',
      content: [
        'Dosad je ploča prikazivala ono što joj je rečeno: uz liniju je pisalo Radi zato što je tako bila označena. Sada web svakih pet minuta pokuca na svaku adresu i zapiše je li se itko javio.',
        'Jedno propušteno kucanje je slučajnost i ne mijenja ništa. Nakon dva zaredom linija se prikazuje kao Kasni:',
        {
          ul: [
            'njezini vlakovi stanu gdje jesu,',
            'njezina završna stanica i status poprime boju ulične rasvjete,',
            'ploča piše „Trenutačno ne odgovara”.',
          ],
        },
        'Kad se web ponovno javi, linija ponovno vozi. Kasniti mogu samo linije označene kao aktivne. Linija u izgradnji ostaje u izgradnji, što god njezina adresa radila.',
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
        'Chat apps keep these pictures for days, so a card shows the line as it was set, not the live status from the board.',
      ],
    },
    hr: {
      title: 'Poveznice stižu s kartom',
      summary:
        'Zalijepite stranicu projekta u razgovor i njezin pregled nacrta kartu linija, s osvijetljenom linijom tog projekta.',
      content: [
        'Svaka stranica ovdje ima karticu za dijeljenje: sliku koju aplikacija za razgovor prikaže ispod poveznice. Svaka je nacrtana iz iste geometrije kao karta na početnoj stranici, pa poveznica na projekt stiže kao karta na kojoj je linija tog projekta osvijetljena, a ostale prigušene.',
        'Aplikacije za razgovor te slike čuvaju danima, pa kartica prikazuje liniju onako kako je postavljena, a ne trenutačni status s ploče.',
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
  await seedNotes(payload)
  const { totalDocs } = await payload.count({ collection: 'projects', overrideAccess: true })
  if (totalDocs > 0) {
    // The projects are there already: the services and capabilities name them by slug.
    await seedOffer(payload)
    return
  }
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
        ...wordsOf(project.en),
        addresses: project.addresses.map((address) => ({ url: address.url, label: address.en })),
      },
    })
    await payload.update({
      collection: 'projects',
      id: created.id,
      locale: 'hr',
      data: {
        ...wordsOf(project.hr),
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
      headline: 'Built to run',
      email: 'hello@fromnowhere.dev',
      lede: 'Fromnowhere is a software studio. It designs, builds and hosts websites, products and community tools, and keeps them running after launch. Each line below is a project that left from here.',
      defaultDescription:
        'Fromnowhere is a software studio: websites with an editor, products, community tools, and the servers they run on.',
    },
  })
  await payload.updateGlobal({
    slug: 'studio',
    locale: 'hr',
    data: {
      headline: 'Izrađeno da radi',
      lede: 'Fromnowhere je softverski studio. Dizajnira i izrađuje web stranice, proizvode i alate za zajednice, brine se za njihov hosting i održava ih u pogonu nakon objave. Svaka linija ispod projekt je koji je krenuo odavde.',
      defaultDescription:
        'Fromnowhere je softverski studio: web stranice s uređivačem, proizvodi, alati za zajednice i poslužitelji na kojima rade.',
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

  await seedOffer(payload)

  payload.logger.info('Seed: done.')
}

/** The first notes, when there are no notes at all (drafts included). */
async function seedNotes(payload: Payload) {
  // Counts every note, drafts too: a draft lives in the collection with `_status: draft`.
  const { totalDocs } = await payload.count({ collection: 'notes', overrideAccess: true })
  if (totalDocs > 0) return
  payload.logger.info('Seed: writing the first notes.')
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
}
