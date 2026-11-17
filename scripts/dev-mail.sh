#!/usr/bin/env bash
# The contact form on your own machine: makes a local certificate authority and a certificate for
# a mail catcher (Mailpit, compose.dev.yml) on localhost, once, in .dev/mail/ (never committed).
#
# The relay sends only over TLS with a checked certificate (src/lib/relay/mail.ts), in development
# too, so Mailpit speaks STARTTLS with this certificate and the dev server trusts the authority
# through NODE_EXTRA_CA_CERTS (`pnpm dev:mail`). Nothing in the relay is loosened for it.
#
#   ./scripts/dev-mail.sh                              # the certificates (again: does nothing)
#   podman compose -f compose.dev.yml up -d            # the database and Mailpit
#   pnpm dev:mail                                      # the dev server, trusting the authority
#
# Then fill the six CONTACT_* variables in .env as .env.example's "On your own machine" says,
# send the form at http://localhost:3000/en/contact, and read it at http://localhost:8025.
set -euo pipefail

cd "$(dirname "$0")/.."
dir=.dev/mail
if [ -f "$dir/ca.crt" ] && [ -f "$dir/mail.crt" ] && [ -f "$dir/mail.key" ]; then
  echo "The certificates are already in $dir."
  exit 0
fi
mkdir -p "$dir"
cd "$dir"

# The authority: lives on this machine only, trusted only by the dev server.
openssl req -x509 -new -nodes -newkey rsa:2048 -days 825 -sha256 \
  -subj '/CN=fromnowhere.dev local mail' \
  -keyout ca.key -out ca.crt 2>/dev/null

# The mail catcher's certificate, for localhost and 127.0.0.1.
openssl req -new -nodes -newkey rsa:2048 -subj '/CN=localhost' \
  -keyout mail.key -out mail.csr 2>/dev/null
printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > mail.ext
openssl x509 -req -in mail.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 825 -sha256 -extfile mail.ext -out mail.crt 2>/dev/null
rm -f mail.csr mail.ext ca.srl
# Mailpit runs as its own user inside its container: the key must be readable there.
chmod 644 mail.key mail.crt ca.crt
chmod 600 ca.key
echo "Made $dir/ca.crt and the mail catcher's certificate."
