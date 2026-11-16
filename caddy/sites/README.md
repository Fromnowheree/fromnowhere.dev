# Other sites on this server

Every `*.caddy` file here is imported by `caddy/Caddyfile`, so one Caddy can serve the other
fromnowhere.dev sites that run on the same server (yugioh.fromnowhere.dev, later
medical.fromnowhere.dev) next to this one. Each file is one site block, for example:

```caddy
yugioh.fromnowhere.dev {
	encode zstd gzip
	reverse_proxy fnwygo-web-1:3000
}
```

The other app's container must be on a network Caddy shares (README, "Other sites on this
server"). An empty folder is fine: the glob matching nothing is not an error.
