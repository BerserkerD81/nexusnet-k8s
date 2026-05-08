Patroni HA (dev) — local test stack
=================================

What this provides
- A development-ready Docker Compose stack with: etcd (cluster store), three Patroni Postgres nodes, and HAProxy as a single connection endpoint.
- Purpose: test automatic failover/promotion and validate your app against a highly available PostgreSQL endpoint before deploying to Azure.

Files
- `docker-compose.yml` — the Compose stack (etcd, patroni1..3, haproxy)
- `haproxy.cfg` — HAProxy config that exposes a single port `5432` and routes to the current primary

Notes
- This is intended for local testing only. Production requires Kubernetes (Patroni as StatefulSet) or a managed DB.
- Images used are community images; if any image tag fails, try replacing with a vendor image you trust (Bitnami, Zalando).

Quick start (local)
1. From the backend folder:

```bash
cd /home/jorge/projects/nexusnet-backend/docker/patroni
docker compose up -d
```

2. Watch logs until one node becomes leader:

```bash
docker compose logs -f patroni1 patroni2 patroni3
```

3. Connect your app to HAProxy endpoint:

```
postgresql://postgres:postgres@localhost:5432/nexusnet
```

4. Test failover:
- Stop the primary container (`docker stop <primary-container>`). Patroni should promote a replica and HAProxy will route to the new primary.

Deploying to Azure (high level)
- Use AKS with StatefulSets and PersistentVolumeClaims (managed disks) for Postgres nodes.
- Deploy etcd (or use an external etcd managed solution). For small setups you can run etcd as a StatefulSet.
- Use a Kubernetes Service (LoadBalancer) or an Internal LoadBalancer for the application to reach HAProxy (or directly Patroni REST endpoints via a headless Service plus a proxy).
- Use Azure Managed Disks for durable storage and a regular backup strategy (pgBackRest, Azure backup, or managed DB snapshots).

I can: (A) bring this stack up locally and run a short failover test, or (B) generate Kubernetes manifests for AKS (StatefulSet + Services + PVCs + ConfigMaps). Which do you want next?
