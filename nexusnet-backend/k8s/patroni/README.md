Patroni on AKS — manifests and deployment notes
===============================================

This folder contains example Kubernetes manifests to run a Patroni-based PostgreSQL cluster on AKS for high availability. These manifests are templates and need configuration for production (storage class, resource sizing, secrets management).

Files
- `etcd-statefulset.yaml` — etcd cluster (3 replicas). You can replace with a managed key/value store if preferred.
- `patroni-configmap.yaml` — Patroni configuration (bootstrap, replication settings).
- `patroni-statefulset.yaml` — Patroni StatefulSet (3 replicas) with PVC templates.
- `patroni-service.yaml` — headless service to reach Patroni pods.
- `haproxy-deployment.yaml` — optional HAProxy Deployment + Service (LoadBalancer) that provides a single writable endpoint.

Quick deploy (AKS)
1. Create an AKS cluster and set kubectl context.
2. Edit the manifests: set the correct `storageClassName` in PVC templates and update image tags if needed.
3. Apply manifests in order:

```bash
kubectl apply -f etcd-statefulset.yaml
kubectl apply -f patroni-configmap.yaml
kubectl apply -f patroni-statefulset.yaml
kubectl apply -f patroni-service.yaml
kubectl apply -f haproxy-deployment.yaml
```

4. Wait for pods to be Ready, then point your application `DATABASE_URL` to the HAProxy LoadBalancer IP (or use an internal LoadBalancer for private access):

```
postgresql://postgres:<password>@<haproxy-ip>:5432/nexusnet
```

Notes for production
- Use Azure Managed Disks for PVCs and define an appropriate StorageClass.
- Use Azure Key Vault (or Kubernetes Secrets with RBAC) to store DB passwords.
- Consider using an operator (Zalando Postgres Operator) that manages Patroni for you.
- Ensure regular backups (pgBackRest) and monitoring (Prometheus exporters).
