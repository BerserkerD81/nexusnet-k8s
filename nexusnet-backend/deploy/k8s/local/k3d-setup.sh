#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# k3d local cluster setup for NexusNet
# Usage: ./k3d-setup.sh <CLUSTER_NAME> <WORKERS>
# Example: ./k3d-setup.sh nexusnet 2

CLUSTER=${1:-nexusnet}
WORKERS=${2:-2}

echo "Creating k3d cluster: $CLUSTER with $WORKERS worker nodes..."

# Create cluster with local image registry and port mappings
k3d cluster create "$CLUSTER" \
  --agents "$WORKERS" \
  -p "80:80@loadbalancer" \
  -p "443:443@loadbalancer" \
  -p "3000:3000@loadbalancer" \
  --registry-create "$CLUSTER-registry:0.0.0.0:5000" \
  --wait

# Get kubeconfig
k3d kubeconfig get "$CLUSTER" > /tmp/k3d-"$CLUSTER".yaml
export KUBECONFIG=/tmp/k3d-"$CLUSTER".yaml
kubectl cluster-info

# Install nginx ingress controller
echo "Installing nginx ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.4/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=120s

# Create StorageClass for local volumes
echo "Creating local StorageClass..."
kubectl apply -f local-storageclass.yaml

# Create JWT secret (default dev values)
echo "Creating JWT secrets..."
kubectl create secret generic nexusnet-jwt-secrets \
  --from-literal=JWT_SECRET="dev_local_jwt_secret_12345" \
  --from-literal=JWT_REFRESH_SECRET="dev_local_jwt_refresh_67890" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "k3d cluster '$CLUSTER' ready."
echo "Kubeconfig: export KUBECONFIG=/tmp/k3d-$CLUSTER.yaml"
echo "Next: build and load image, then deploy manifests."
