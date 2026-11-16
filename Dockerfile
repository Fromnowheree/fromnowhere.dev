# Production image for fromnowhere.dev (Next.js standalone output + Payload CMS).
#
# Built in CI (.github/workflows/ci.yml, on a version tag), never on the server: a 1-2 GB
# server cannot build Next.js reliably. CI keeps no copy yet (no registry), so to install one,
# build it by hand from the release's tag, for the VPS's processor (most are linux/amd64; an
# image built for an ARM laptop's own will not start there):
#
#   version="$(node -p "require('./package.json').version")"
#   docker build --platform linux/amd64 -t "fromnowhere-web:$version" \
#     --build-arg APP_VERSION="$version" --build-arg APP_COMMIT="$(git rev-parse HEAD)" .
#
# The health check lives in compose.yml, not here: podman builds OCI images by default, and the
# OCI format has no HEALTHCHECK, so the instruction would be dropped with only a warning.

FROM docker.io/library/node:26-alpine AS base
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# The build stages only: the runner needs no package manager.
FROM base AS pnpm
# pnpm is installed at the version package.json's `packageManager` names (pnpm@12.20.0), so that
# field stays its one source. Node 25+ ships no corepack, so `corepack enable` would fail here.
COPY package.json ./
RUN npm i -g "$(node -p "require('./package.json').packageManager")" \
      --no-fund --no-audit --no-update-notifier && npm cache clean --force

FROM pnpm AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM pnpm AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The Payload config is loaded during the build but never connects; these values are build-only
# placeholders, not secrets. `public/` may not exist (the icons live in src/app); the runner
# copies it either way, so a file added there later ships without touching this file.
RUN mkdir -p public && \
    DATABASE_URL=postgres://build:build@localhost:5432/build PAYLOAD_SECRET=build-only pnpm build

FROM base AS runner
# Which release this is, readable with `docker inspect` (CI passes both; a hand build without
# them honestly says it is a development build).
ARG APP_VERSION=0.0.0-dev
ARG APP_COMMIT=unknown
LABEL org.opencontainers.image.title="fromnowhere-web" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${APP_COMMIT}" \
      org.opencontainers.image.licenses="LicenseRef-Proprietary"
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_DIR=/app/media \
    APP_VERSION=${APP_VERSION} \
    APP_COMMIT=${APP_COMMIT}

# A fixed, unprivileged user; nothing in the image runs as root.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Provisioning: creates the first admin (scripts/create-admin.sh runs it in this container).
COPY --from=builder --chown=nextjs:nodejs /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
# The seed's committed window captures (src/seed/windowSeeds.ts), read from the working directory
# when PAYLOAD_SEED is on. The directory always exists (it keeps a .gitkeep), even with none.
COPY --from=builder --chown=nextjs:nodejs /app/src/seed/windows ./src/seed/windows
# The uploads volume and Next's image cache are the only places the server writes, so compose
# can run the container with a read-only root filesystem.
RUN mkdir -p media .next/cache && chown nextjs:nodejs media .next/cache

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
