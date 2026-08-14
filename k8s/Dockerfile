# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════════════
#  Net2APP — production container image (K3s / containerd compatible)
#
#  Uses Next.js `output: "standalone"` (see next.config.ts) so the runtime
#  image carries only the server + bundled deps. Builds fine with plain
#  `docker build`, `nerdctl build` (containerd), or buildkitd — no Docker
#  Desktop / daemon requirement on the k3s nodes.
#
#  Build:
#    docker build -t net2app:2.4.6 -f k8s/Dockerfile .
#    docker build --target worker -t net2app-worker:2.4.6 -f k8s/Dockerfile .
#    # or, on a containerd-only host:
#    nerdctl -n k8s.io build -t 127.0.0.1:5000/net2app:2.4.6 -f k8s/Dockerfile .
#
#  The image is intentionally rootless (USER node) and runs the standalone
#  server:  HTTP on :5556, SMPP on :2775 (same ports as the PM2 fleet).
#
#  NOTE: a .dockerignore at the repo root keeps secrets (.env, .server-creds)
#  and heavy dirs (node_modules, .next) out of the build context.
# ═══════════════════════════════════════════════════════════════════════

# ── Stage 1: dependencies (FULL — next build needs eslint/typescript/tsx) ──
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: runtime (standalone is self-contained — no npm ci needed) ─
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5556 \
    SMPP_PORT=2775 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 5556 2775
USER node

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5556/api/public/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]

# ── Stage 4 (optional): OTT worker image ──────────────────────────────
# The OTT worker (WhatsApp/Telegram, Baileys/gramjs) runs from TS source via
# tsx, so it needs the full tree + dev toolchain.
#   docker build --target worker -t net2app-worker:2.4.6 -f k8s/Dockerfile .
FROM node:22-slim AS worker
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "tsx", "src/workers/ott-worker.ts"]
