# Net2APP → Kubernetes (K3s) Migration Plan

> **Status:** Planned. The live PM2 fleet stays active until the K3s POC is validated.
> **Version:** 1.0 · **Date:** August 2026

---

## 1. Why / What stays the same

### Goals
- Replace the per-server PM2 process manager with a containerized Kubernetes workload (K3s — a lightweight, CNCF-certified distribution that runs on the existing Ubuntu VPS fleet without Docker Desktop; it ships its own containerd).
- **Keep the existing schema-per-tenant isolation** — it is the platform's core multi-tenancy model and is *independent of the runtime*. A tenant is a Postgres schema (`tenant_*`); the app resolves `tenants.schema_name` per request. Nothing about that changes.
- Zero-downtime cutover, tenant by tenant, with instant rollback.

### What stays the same
| Concern | PM2 fleet (today) | K3s (target) |
|---|---|---|
| Tenant isolation | Postgres schema per tenant | Postgres schema per tenant (**unchanged**) |
| Tenant → server pinning | `tenants.smpp_server_ip` picks the app+DB instance | **Gone** — central DB, any pod serves any tenant |
| SMPP port for phones | `SERVER_IP:2775` | `NODE_IP:2775` (NodePort) — **same numbers** |
| HTTP(S) front door | nginx on each box | Ingress controller (nginx or Traefik) |
| HTTP app port | 5556 | 5556 (container) |
| Worker processes | pm2: net2app + ott-worker | 2 Deployments: `net2app-web`, `net2app-ott-worker` |
| Supervision | health-check.sh + watchdog cron | kubelet + readiness/liveness probes + `RestartPolicy` |

### The single biggest change
Today a tenant's traffic is pinned to one server (their schema lives only on that server's local Postgres). On K3s, **all tenant schemas move into one central Postgres** and every pod can serve every tenant. This is what makes the cluster elastic — and it is the part that must be migrated carefully (see §5).

---

## 2. Target architecture

```
                        Cloudflare (TLS/WAF)
                                │
                ┌───────────────▼───────────────┐
                │      K3s cluster (5 nodes)     │
                │                               │
                │  ┌─────────────────────────┐  │
                │  │  Ingress (nginx)        │  │  HTTPS :443
                │  │  → net2app-web:5556     │  │
                │  └───────────┬─────────────┘  │
                │              │                │
                │  ┌───────────▼─────────────┐  │
                │  │ Deployment net2app-web  │  │  HTTP :5556 (container)
                │  │ (replicas: 1 → N later) │  │  SMPP :2775 (container)
                │  └──┬─────────────────┬───┘  │
                │     │                 │       │
                │  NodePort smpp:2775   │       │
                │  (phones/ESMEs)       │       │
                │  ┌────────────────────▼───┐   │
                │  │ Deployment ott-worker  │   │  WhatsApp / Telegram
                │  └───────────┬────────────┘   │
                │              │                │
                │  ┌───────────▼─────────────┐  │
                │  │ StatefulSet postgres:16 │  │  5432 (central DB,
                │  │ (or managed PG)         │  │  all tenant_* schemas)
                │  └─────────────────────────┘  │
                └───────────────────────────────┘
```

**Node roles (planned):**
| Node | IP | Role |
|---|---|---|
| Canada Dev (POC) | 15.235.35.125 | K3s **server** (control-plane + worker) — runs the POC stack |
| Canada Origin | 149.56.22.232 | K3s **agent** (worker) — cutover target |
| France | 54.37.252.5 | K3s **agent** (worker) |
| Germany | 145.239.1.7 | K3s **agent** (worker) |
| Sydney | 139.99.148.65 | K3s **agent** (worker) |

The PM2 fleet keeps running on Origin/France/Germany/Sydney (and Dev until the POC validates) exactly as today — K3s installs alongside it.

---

## 3. Phase 0 — Container image (no Docker daemon required)

The Dockerfile (see `k8s/Dockerfile`) uses Next.js `output: "standalone"` so the runtime image is small. It builds with **any** OCI builder:

```bash
# On the Dev box (has the repo + build deps):
cd /home/ubuntu/saas-sms-platform-architecture

# Option A — docker build (if docker CLI is present on the build box):
docker build -t net2app:2.4.6 -f k8s/Dockerfile .
docker build --target worker -t net2app-worker:2.4.6 -f k8s/Dockerfile .

# Option B — pure containerd (nerdctl) on the k3s node:
#   install buildkit + nerdctl, then:
nerdctl -n k8s.io build -t 127.0.0.1:5000/net2app:2.4.6 -f k8s/Dockerfile .
```

**Registry.** k3s needs a registry the nodes can pull from. Simplest for the POC: run a small registry on Dev and point k3s at it via `/etc/rancher/k3s/registries.yaml` on every node:

```bash
# Dev: run the registry container on :5000
nerdctl run -d --restart=always --name registry -p 5000:5000 registry:2
nerdctl -n k8s.io push 127.0.0.1:5000/net2app:2.4.6

# Every node:
cat > /etc/rancher/k3s/registries.yaml <<'EOF'
mirrors:
  "127.0.0.1:5000":
    endpoint:
      - "http://15.235.35.125:5000"
EOF
# (or use GHCR / a cloud registry for production)
```

**APKs.** The Android APK download endpoint reads `/opt/net2app/android-app/` (v2.4.6 + history). The deployment mounts that host dir via `hostPath` for the POC; replace with a PVC populated from any fleet server for production.

---

## 4. Phase 1 — Single-node K3s POC on Canada Dev

```bash
# 1) Install k3s (server, latest stable) on Dev:
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --disable traefik        # we install ingress-nginx later (or keep traefik)

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes   # dev ready

# 2) Local-path storage class is installed by default (used by the manifests).

# 3) Deploy the stack:
kubectl apply -f k8s/base.yaml
kubectl -n net2app create secret generic net2app-secrets \
  --from-literal=DATABASE_URL='postgresql://postgres:CHANGE_ME@net2app-postgres:5432/app_db' \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=POSTGRES_PASSWORD='CHANGE_ME'
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/net2app-deployment.yaml
kubectl apply -f k8s/net2app-ingress.yaml
kubectl apply -f k8s/ott-worker.yaml

kubectl -n net2app rollout status deployment/net2app-web
kubectl -n net2app get pods,svc,pvc
```

### POC validation checklist (before any tenant moves)
- [ ] `curl http://localhost:5556/api/public/health` inside the pod → 200 healthy
- [ ] `/api/public/server-list` lists the 5 fleet IPs (unchanged for the Android app)
- [ ] `nc -vz <dev-ip> 2775` from a phone/another box → open (NodePort)
- [ ] Login to a **test tenant** schema in the central DB and send an SMS via `/api/tenant/send-sms` (HTTP route)
- [ ] Raw SMPP bind: `npx tsx test-smpp-raw-bind.ts` against `<dev-ip>:2775`
- [ ] Android gateway: register a phone against the POC (SMPP SERVER mode on :2775 **and** REST `/api/public/gateway/register` → `/poll`), send MT, confirm DLR
- [ ] `kubectl delete pod -n net2app net2app-web-xxx` → readiness/liveness restart, phone re-binds
- [ ] Voice OTP: `npm run test:voice-otp-e2e` against the POC DB (Asterisk path must be reachable — see §7 caveat)

---

## 5. Phase 2 — Database consolidation (the critical step)

Today each server's local Postgres holds the schemas of *its* tenants. The cluster needs **one** database holding **all** schemas.

### 5.1 Inventory
On each fleet server, list what it owns (already scripted): `scripts/migrate-schemas-to-assigned-servers.sh` + `scripts/sync-all-tenants.sh` show the layout; `tenants.smpp_server_ip` is the source of truth. Current split: Germany 22, France 19, Origin 11, Sydney 1, Dev 1 (+ copies on Dev).

### 5.2 Migrate platform tables first (public schema)
```bash
# On each source server (Origin, France, Germany, Sydney), dump PUBLIC-platform data:
pg_dump -h 127.0.0.1 -U postgres -d app_db \
  --schema=public --no-owner --no-privileges -Fc > public.dump
psql "postgresql://postgres:CHANGE_ME@<cluster-pg>:5432/app_db" \
  -c "CREATE SCHEMA IF NOT EXISTS public"   # merge, don't overwrite
pg_restore -h <cluster-pg> -U postgres -d app_db --no-owner \
  --data-only -t tenants -t platform_settings -t android_gateway_devices \
  -t super_admins -t mcc_mnc_database public.dump   # adjust table list to actual schema
```
> **Conflict note:** `tenants` rows exist on every server (each server only has its own active tenants, so primary-key collisions are unlikely — verify `ON CONFLICT` handling and dedupe `android_gateway_devices` by `device_id`).

### 5.3 Migrate each tenant schema, one at a time (rollback-safe)
```bash
# Per tenant schema, per source server:
SCHEMA=tenant_nexahubsms_1786321285063
pg_dump -h 127.0.0.1 -U postgres -d app_db -n "$SCHEMA" --no-owner --no-privileges \
  | psql "postgresql://postgres:CHANGE_ME@<cluster-pg>:5432/app_db"
```
- **Do NOT drop the source schema** during cutover — it stays as the instant rollback.
- Use `scripts/migrate-schemas-to-assigned-servers.sh` as a template; a new `scripts/migrate-schemas-to-cluster.sh` should wrap the pg_dump|psql per schema with logging + a checksum (`pg_dump | sha256sum` on both ends).

### 5.4 Backfill the schema columns
Run the same post-restore steps the deploy script does (idempotent):
`drizzle/0040_add_suppliers_updated_at_columns.sql`, audit triggers (0038/0039), `seed-voice-otp-languages.sql`, `sync-mccmnc.sh`.

### 5.5 Production recommendation
Prefer **managed Postgres** (e.g. hosted PG with PITR + automated backups) over the in-cluster StatefulSet. The StatefulSet in `k8s/postgres-statefulset.yaml` is for the POC. If you stay self-hosted, add: nightly `pg_dump -Fc`, WAL archiving, and a standby (streaming replication) before cutover.

---

## 6. Phase 3 — Join the remaining 4 nodes

```bash
# On the Dev K3s server, get the token:
NODE_TOKEN=$(cat /var/lib/rancher/k3s/server/node-token)

# On EACH worker (Origin, France, Germany, Sydney) — PM2 fleet keeps running:
curl -sfL https://get.k3s.io | K3S_URL=https://15.235.35.125:6443 \
  K3S_TOKEN="$NODE_TOKEN" sh -s - --node-label "topology.kubernetes.io/zone=<region>"

# On Dev, label/taint so POC pods stay put while workers join:
kubectl label node <dev> node-role.kubernetes.io/control-plane=true
kubectl taint nodes <dev> node-role.kubernetes.io/control-plane:NoSchedule   # optional

kubectl get nodes -o wide   # expect 5 Ready
```

Ports that must be open **between nodes** (k3s server: 6443, 8472/udp (flannel VXLAN), 10250; worker: 10250). Cloud firewall groups (OVH private network) recommended.

---

## 7. Phase 4 — Zero-downtime cutover (per tenant)

Cut over **one tenant at a time**. The tenant's domain (A record / Cloudflare) is the switch.

```
For each tenant T:
 1. Snapshot  : pg_dump -n "tenant_T" from its current server  → cluster PG (5.3)
 2. Verify    : run the POC validation suite against tenant_T's schema on the cluster
 3. DNS switch: point tenant_T's domain A record at the cluster (any node IP / LB VIP)
                Cloudflare: orange-cloud OFF during the cutover window, ON after
 4. Observe   : messages flowing, DLRs arriving, Android gateway bound
 5. Mark      : tenants.smpp_server_ip = '<cluster-vip>' on the cluster DB
 6. Keep      : old schema on the old server for 72h (rollback window), then drop
```

### Rollback (instant)
1. Point tenant_T's domain back at its old server IP.
2. Old server still serves its own schema (nothing was deleted).
3. (Optional) diff cluster vs old messages table and re-sync any rows written to the cluster during the window.

### Ordering
- Start with the **least critical** tenant (e.g. `tenant_net2app_demo_*`) and one low-traffic production tenant.
- Move voice-heavy tenants last (Asterisk AMI is currently a host service, not a container; see caveat below).
- Keep **Sydney** as the last mover — smallest footprint, useful as a PM2 canary while everything else is on K3s.

### Caveats to plan around
1. **Voice OTP / Asterisk AMI** — `voice-otp-engine` dials `ASTERISK_AMI_HOST`. The fleet boxes run Asterisk on the host. Options: (a) run Asterisk on one dedicated node and point the cluster at it, (b) sidecar container with Asterisk, (c) ship the external voice-OTP HTTP API (already supported per-supplier). Do NOT move voice tenants until this is decided.
2. **In-memory state** — SMPP session maps, the REST gateway registry (MT queue/inflight), and the DLR callbacks live in process memory (`globalThis`). At `replicas: 1` this is identical to today. Before scaling out, externalize the REST registry + DLR queue to Redis/PG (the code comments in `src/lib/gateway-rest-registry.ts` call this out explicitly).
3. **Uploads** — currently on local disk (`public/uploads`); the Deployment mounts a PVC. Sync the existing files once at cutover.
4. **Mail server** — Germany is the mail server (Postfix). Keep mail on the host VM; only the app's SMTP env vars point at it (`SMTP_HOST=145.239.1.7`).

---

## 8. Day-2 operations

- **Upgrades:** push a new image → `kubectl -n net2app set image deployment/net2app-web net2app=localhost:5000/net2app:<tag>` (rolling, `maxUnavailable: 0`). The old PM2 fleet is your instant fallback throughout the transition.
- **Backups:** nightly `pg_dump -Fc` of the cluster DB + `kubectl get ... -o yaml` exports; test a restore in a scratch namespace.
- **Monitoring:** point the existing `pm2-health-monitor` / UptimeRobot at the Ingress URL; add kube-state-metrics + Prometheus for node/pod health.
- **Secrets:** rotate `JWT_SECRET` + `DATABASE_URL` via `kubectl create secret` (manifest ships a template only).
- **Cleanup:** after the last tenant cut over and the 72h windows close, decommission PM2 per server: stop the app, keep nginx → k3s (or migrate DNS wholesale), then `pm2 kill` and drop the local `net2app` systemd unit.

---

## 9. File index (this repo)

| File | Purpose |
|---|---|
| `k8s/Dockerfile` | Production image (standalone) + optional OTT-worker target |
| `k8s/base.yaml` | Namespace, ConfigMap, Secret template |
| `k8s/postgres-statefulset.yaml` | Central Postgres (POC option) |
| `k8s/net2app-deployment.yaml` | Web Deployment + HTTP/SMPP services + HPA + uploads PVC |
| `k8s/net2app-ingress.yaml` | Ingress with per-tenant rules |
| `k8s/ott-worker.yaml` | WhatsApp/Telegram worker Deployment |
| `scripts/migrate-schemas-to-assigned-servers.sh` | Reference for per-schema migration patterns |
| `scripts/cleanup-invalid-suppliers.sql` | Deactivate junk suppliers (already run fleet-wide) |

---

## 10. Risk summary

| Risk | Likelihood | Mitigation |
|---|---|---|
| Central DB becomes a SPOF | Med | Managed PG / standby + PITR backups; keep per-server schemas 72h |
| Pod restart drops Android/SMPP sessions | High (any restart) | Phones auto-reconnect; rolling updates `maxUnavailable: 0`; `terminationGracePeriodSeconds: 30` |
| Multi-replica split of in-memory gateway registry | Only if scaled | Keep `replicas: 1` until registry moves to Redis/PG |
| Voice OTP (Asterisk AMI) not containerized | Med | Host-side Asterisk + env pointer, or external voice API |
| Tenants on 4 servers see cutover blips | Low | Per-tenant DNS switch, verify before/after, instant rollback |
