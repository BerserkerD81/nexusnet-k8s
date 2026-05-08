# Local K3D Testing Guide

Test the NexusNet backend Kubernetes manifests locally with **k3d** (lightweight Kubernetes in Docker).

## Prerequisites

Install:
- [k3d](https://k3d.io/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Docker](https://docs.docker.com/get-docker/)

Verify:
```bash
k3d version
kubectl version --client
docker --version
```

## Quick Start

### 1. Create k3d cluster

```bash
chmod +x k3d-setup.sh
./k3d-setup.sh nexusnet 2
```

This creates:
- 1 control plane + 2 worker nodes
- Local container registry (nexusnet-registry:5000)
- nginx-ingress controller
- JWT secrets
- Local storage class

### 2. Build and load API image

From the backend root directory:

```bash
docker build -t nexusnet-api:local -f docker/Dockerfile.prod .
k3d image import nexusnet-api:local -c nexusnet
```

### 3. Deploy to k3d

```bash
export KUBECONFIG=/tmp/k3d-nexusnet.yaml
./k3d-deploy.sh nexusnet
```

Verify:
```bash
kubectl get pods
kubectl get svc
kubectl get ing
```

## Testing & Demo

Run the full demo script:

```bash
./k3d-test-demo.sh nexusnet
```

This demonstrates:
- Manual scaling (5 → 2 replicas)
- HPA behavior (CPU-based autoscaling)
- Pod recovery (delete a pod and watch it respawn)
- Service discovery and Ingress routing
- Health check logs

### Manual test commands

**Port-forward to the service:**
```bash
kubectl port-forward svc/nexusnet-api 3000:3000
curl http://localhost:3000/health
```

**Check HPA status:**
```bash
kubectl get hpa -w
```

**Scale deployment manually:**
```bash
kubectl scale deployment/nexusnet-api --replicas=5
kubectl get pods -w
```

**Delete a pod (tests recovery):**
```bash
kubectl delete pod nexusnet-api-<hash>
```

**Watch logs:**
```bash
kubectl logs -f deployment/nexusnet-api
```

**Check storage:**
```bash
kubectl get pvc
kubectl get pv
```

## Troubleshooting

**Pods stuck in Pending:**
```bash
kubectl describe pod <POD_NAME>
kubectl get events -w
```

**Image pull error:**
Ensure you loaded the image: `k3d image import nexusnet-api:local -c nexusnet`

**Ingress not working:**
Check ingress controller: `kubectl get pods -n ingress-nginx`

**Storage issues:**
Check provisioner: `kubectl get storageclasses`

## Cleanup

```bash
./k3d-cleanup.sh nexusnet
```

This stops and removes the cluster and kubeconfig.

## Comparison: Local vs AKS

| Feature | k3d (Local) | AKS (Azure) |
|---------|-----------|-----------|
| Setup time | ~2 min | ~10 min |
| Cost | Free | Metered |
| Persistence | Local volumes | Managed disks |
| Networking | localhost:port | Load balancer IPs |
| HPA | CPU-based | CPU + custom metrics |
| Secrets | Local | Key Vault |
| Use case | Dev/test | Production |

## For class presentation

1. Show cluster creation: `./k3d-setup.sh`
2. Demo scaling & HPA: `./k3d-test-demo.sh`
3. Show recovery: delete pod, explain PDB + replicas
4. Explain Ingress networking
5. Show storage mounts and data persistence
6. Transition to AKS for production (same manifests, different provisioning)

---

See [../README.md](../README.md) for AKS production setup.