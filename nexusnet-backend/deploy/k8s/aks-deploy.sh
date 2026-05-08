#!/usr/bin/env bash
set -euo pipefail

# AKS deploy helper
# Usage: ./aks-deploy.sh <RESOURCE_GROUP> <AKS_NAME> <ACR_NAME> <LOCATION>
# Example: ./aks-deploy.sh nexusnet-rg nexusnet-aks nexusnetacr eastus

RG=${1:-nexusnet-rg}
AKS=${2:-nexusnet-aks}
ACR=${3:-nexusnetacr$RANDOM}
LOC=${4:-eastus}
DOMAIN=${DOMAIN:-nexusnet.local}
IMAGE_TAG=${ACR}.azurecr.io/nexusnet-api:latest

echo "ResourceGroup: $RG, AKS: $AKS, ACR: $ACR, Location: $LOC"

# 1) Login
# az login

# 2) Create resource group
az group create -n "$RG" -l "$LOC"

# 3) Create ACR
az acr create -n "$ACR" -g "$RG" --sku Standard --admin-enabled true
az acr login -n "$ACR"

# 4) Build and push image (context: backend root)
docker build -t "$IMAGE_TAG" ..
docker push "$IMAGE_TAG"

# 5) Create AKS cluster with autoscaler enabled and attach ACR
az aks create -g "$RG" -n "$AKS" --node-count 3 \
  --enable-addons monitoring --attach-acr "$ACR" \
  --enable-cluster-autoscaler --min-count 2 --max-count 5 --generate-ssh-keys

az aks get-credentials -g "$RG" -n "$AKS"

# 6) Install ingress controller (nginx)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace || true

# 7) Create StorageClass (Azure Disk), PVC, and secrets
kubectl apply -f azure-storageclass.yaml
kubectl apply -f pvc.yaml

# Create JWT secret (replace with secure values or integrate Key Vault)
read -r -p "Enter JWT_SECRET (or press Enter to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi
read -r -p "Enter JWT_REFRESH_SECRET (or press Enter to generate): " JWT_REFRESH_SECRET
if [ -z "$JWT_REFRESH_SECRET" ]; then
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
fi
kubectl create secret generic nexusnet-jwt-secrets --from-literal=JWT_SECRET="$JWT_SECRET" --from-literal=JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" --dry-run=client -o yaml | kubectl apply -f -

# 8) Apply manifests
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f pdb.yaml
kubectl apply -f networkpolicy.yaml
kubectl apply -f hpa.yaml
sed "s/\${DOMAIN}/$DOMAIN/g" backend-ingress.yaml | kubectl apply -f -

# 9) Ensure metrics server (for HPA) is installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml || true

echo "Deployment applied. Use 'kubectl get pods -n default' to watch pods."