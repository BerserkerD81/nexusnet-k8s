# AKS deployment guide — NexusNet backend

This folder contains Kubernetes manifests to run the NexusNet backend on AKS. It demonstrates resilient deployment patterns, autoscaling, network segmentation, and secret handling.

Important: Replace image references, hostnames, and secret values before applying to production.

## Overview of artifacts
- `backend-deployment.yaml` — Deployment (replicas=3), liveness/readiness, anti-affinity, ConfigMap
- `backend-service.yaml` — ClusterIP Service
- `backend-ingress.yaml` — Ingress (nginx) + TLS (replace with real cert)
- `backend-secret.yaml` — JWT secrets (stringData placeholder; prefer Key Vault)
- `hpa.yaml` — HorizontalPodAutoscaler (CPU-based)
- `networkpolicy.yaml` — NetworkPolicy restricting ingress/egress
- `pdb.yaml` — PodDisruptionBudget

## AKS quickstart (recommended flow)

1. Login and create resource group

```bash
az login
az group create -n nexusnet-rg -l eastus
```

2. Create an ACR (Azure Container Registry)

```bash
ACR_NAME=nexusnetacr$RANDOM
az acr create -n $ACR_NAME -g nexusnet-rg --sku Standard --admin-enabled true
az acr login -n $ACR_NAME
```

3. Build and push the API image

Option A (local docker):

```bash
docker build -t $ACR_NAME.azurecr.io/nexusnet-api:latest ..
docker push $ACR_NAME.azurecr.io/nexusnet-api:latest
```

Option B (ACR Tasks — recommended):

```bash
az acr build -r $ACR_NAME -t nexusnet-api:latest ..
```

4. Create AKS and attach ACR

```bash
az aks create -g nexusnet-rg -n nexusnet-aks --node-count 3 --enable-addons monitoring --attach-acr $ACR_NAME --generate-ssh-keys
az aks get-credentials -g nexusnet-rg -n nexusnet-aks
```

5. (Optional) Install NGINX ingress controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace
```

6. Create JWT secrets (recommended to use Azure Key Vault + CSI driver in production)

```bash
kubectl create secret generic nexusnet-jwt-secrets --from-literal=JWT_SECRET="<strong_value>" --from-literal=JWT_REFRESH_SECRET="<strong_value>"
```

7. Apply manifests

```bash
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f backend-secret.yaml   # if not using Key Vault
kubectl apply -f pdb.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f hpa.yaml
kubectl apply -f backend-ingress.yaml
```

8. Enable metrics-server (required for HPA if not already present)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## AKS test scripts

I added helper scripts in this folder to provision and manage an AKS test cluster:

- `aks-deploy.sh`: create RG/ACR/AKS, build & push image, attach ACR, install ingress, create StorageClass & PVC, create JWT secret, and apply manifests.
- `scale-deployment.sh`: manually scale the `nexusnet-api` Deployment.
- `shutdown-cluster.sh`: stop or delete the AKS cluster (`az aks stop` or `az aks delete`).

Usage examples:

```bash
chmod +x aks-deploy.sh scale-deployment.sh shutdown-cluster.sh
./aks-deploy.sh my-rg my-aks myacr eastus
./scale-deployment.sh 5
./shutdown-cluster.sh my-rg my-aks
```

## Persistent storage

Files included:

- `azure-storageclass.yaml` — StorageClass using Azure Disk CSI (dynamic provisioning).
- `pvc.yaml` — PersistentVolumeClaim `nexusnet-data-pvc` (10Gi).

The API Deployment mounts the PVC at `/data`. Adjust paths and sizes as needed.

## Resiliency & DR notes
- Replicas, PodDisruptionBudget, anti-affinity and rolling update strategy provide high availability.
- For disaster recovery across regions, replicate data to a secondary region (e.g., Azure Database for PostgreSQL with geo-redundancy) and automate failover.
- For backups, consider Velero to back up cluster resources and PVs.

## Security
- Use Azure Key Vault + AKS Pod Identity (or CSI Secrets Store) for secrets — avoid commit of `backend-secret.yaml` to git.
- Protect ingress with WAF (Azure Application Gateway) or enable managed rules on your ingress controller.
- Enable RBAC and limit permissions for service accounts; consider network policies and Azure Firewall for segmentation.
- Configure Azure AD integration and enforce MFA for cluster admin operations.

## Monitoring
- AKS `--enable-addons monitoring` integrates with Azure Monitor (container insights). Use Prometheus + Grafana if you need custom metrics and ServiceMonitors.

## Demo checklist for class
- Show cluster creation and ACR push (or ACR build).
- Deploy manifests and show app pods becoming Ready.
- Simulate failure: delete a pod and show PDB/HPA behavior + rolling update.
- Show secret injection from Key Vault (demo with CSI driver) or with `kubectl create secret`.
- Show scaling: apply load generator to trigger HPA.
- Explain backup plan and DR approach.

If you want, I can:
- A) Generate a Helm chart instead of raw manifests.
- B) Set up a small local k3d/kind demo that mirrors these manifests for testing.
- C) Add instructions to integrate Azure Key Vault with AKS (CSI driver) and create sample Key Vault resources.

Reply with A, B or C (or ask for changes) and I'll continue.