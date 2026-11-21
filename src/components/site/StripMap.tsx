import type React from 'react'

/**
 * The strip map (Night transit): the home page as a line of its own, like the diagram over a
 * carriage door. One stop per section of the page, the point first, each a link to its section.
 * It stands at the window's left edge on a wide screen and is not shown on a narrow one.
 *
 * The server renders plain links, so it works without JavaScript. `HomeMotion` adds where the
 * visitor is (the stop lit, the track lit down to it, a train that rides there) and a smooth
 * ride to the stop that is clicked.
 */

export type Stop = {
  /** The id of the section it leads to; `top` is the top of the page. */
  to: string
  name: string
}

export function StripMap({ label, stops }: { label: string; stops: Stop[] }) {
  return (
    <nav
      className="strip"
      aria-label={label}
      style={{ '--stops': stops.length } as React.CSSProperties}
    >
      <ol role="list">
        {stops.map((stop) => (
          <li key={stop.to}>
            <a href={`#${stop.to}`}>
              <span className="strip__stop" aria-hidden="true" />
              <span className="strip__name">{stop.name}</span>
            </a>
          </li>
        ))}
      </ol>
      <span className="strip__lit" aria-hidden="true" />
      <span className="strip__train" aria-hidden="true" />
    </nav>
  )
}
