#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# k3d local deployment
# Usage: ./k3d-deploy.sh <CLUSTER_NAME>
# Example: ./k3d-deploy.sh nexusnet

CLUSTER=${1:-nexusnet}
DOMAIN=${DOMAIN:-nexusnet.local}
export KUBECONFIG=/tmp/k3d-"$CLUSTER".yaml

if ! kubectl cluster-info &>/dev/null; then
  echo "Cluster not found or kubeconfig invalid. Run k3d-setup.sh first."
  exit 1
fi

echo "Deploying to k3d cluster: $CLUSTER"

# Apply manifests
kubectl apply -f local-storageclass.yaml
kubectl apply -f pvc.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f pdb.yaml
kubectl apply -f hpa.yaml
sed "s/\${DOMAIN}/$DOMAIN/g" backend-ingress.yaml | kubectl apply -f -

echo "Manifests applied. Waiting for deployment..."
kubectl rollout status deployment/nexusnet-api --timeout=120s

echo "Deployment ready."
kubectl get pods -o wide
echo ""
echo "Service: kubectl port-forward svc/nexusnet-api 3000:3000"
echo "Ingress: Add to /etc/hosts: 127.0.0.1 $DOMAIN"
