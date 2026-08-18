# Net2APP on Kubernetes (K3s) — quickstart

Full plan: **[NET2APP_KUBERNETES_MIGRATION.md](../NET2APP_KUBERNETES_MIGRATION.md)**

## Files
| File | What |
|---|---|
| `Dockerfile` | Production image (standalone). Builds with docker **or** nerdctl/buildkit (containerd-only, no Docker Desktop) |
| `base.yaml` | Namespace + ConfigMap + Secret template |
| `postgres-statefulset.yaml` | Central Postgres (POC). Production → managed PG |
| `net2app-deployment.yaml` | Web Deployment, HTTP Service, **SMPP NodePort 2775**, HPA, uploads PVC |
| `net2app-ingress.yaml` | Ingress (nginx class; swap to `traefik` if you keep k3s default) |
| `ott-worker.yaml` | WhatsApp/Telegram worker (uses the `worker` image target) |
| `kafka-statefulset.yaml` | 3-broker KRaft Kafka (no ZooKeeper) — message bus for the SMS + DLR flow |

## Build
```bash
docker build -t net2app:2.4.6 -f k8s/Dockerfile .
docker build --target worker -t net2app-worker:2.4.6 -f k8s/Dockerfile .
# containerd-only: nerdctl -n k8s.io build -t 127.0.0.1:5000/net2app:2.4.6 -f k8s/Dockerfile .
```

## Deploy
```bash
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
```

## Kafka (SMS / DLR bus)

Deploy the 3-broker KRaft cluster (independent of the web deployment):

```bash
kubectl apply -f k8s/kafka-statefulset.yaml
kubectl -n net2app rollout status statefulset/kafka
```

- **Bootstrap address** (from inside the cluster): `kafka.net2app.svc.cluster.local:9092`
  (or just `kafka:9092` within the `net2app` namespace).
- **Cluster ID** lives in the `kafka-config` ConfigMap. It is stable and shared by
  all three brokers — do not change it after the cluster is formatted.
- **POC only**: PLAINTEXT listeners and in-cluster `local-path` storage. Before
  production, add SASL_SSL, a NetworkPolicy, and managed storage.

Create the topics used by the SMS / DLR flow:

```bash
for t in sms.mt sms.dlr sms.retry; do
  kubectl -n net2app exec kafka-0 -- /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server kafka:9092 \
    --create --if-not-exists --topic "$t" --partitions 6 --replication-factor 3
done
```

| Topic | Producer | Consumer |
|---|---|---|
| `sms.mt` | `smpp-server` / HTTP API | delivery workers (`smpp-client`) |
| `sms.dlr` | delivery workers | DLR processor (updates `messages` + fires webhooks) |
| `sms.retry` | failed / timed-out sends | retry worker |

## Important
- **Keep `replicas: 1`** on `net2app-web` (and the HPA min/max at 1) until the in-memory
  Android REST-gateway registry is moved to Redis/PG — see the migration doc §7.
- **APKs** are served from `/opt/net2app/android-app` (hostPath on the POC).
- **uploads** live on the `net2app-uploads` PVC.
