# Other sites on this server

Every `*.caddy` file here is imported by `caddy/Caddyfile`, so one Caddy can serve the other
fromnowhere.dev sites that run on the same server (yugioh.fromnowhere.dev, later
medical.fromnowhere.dev) next to this one. Each file is one site block, for example:

```caddy
yugioh.fromnowhere.dev {
	encode zstd gzip
	reverse_proxy ygo-web:3000
}
```

The other app's container must be on the network Caddy shares (`compose.shared.yml`, README,
"Other sites on this server"), under the alias the block names. `yugioh.caddy.example` is the
whole block for yugioh.fromnowhere.dev: copy it to `yugioh.caddy` once that site runs here and
its name points at this server (`docs/launch.md`, step 8). Only `*.caddy` is imported, so an
example never asks for a certificate. An empty folder is fine: the glob matching nothing is not
an error.
