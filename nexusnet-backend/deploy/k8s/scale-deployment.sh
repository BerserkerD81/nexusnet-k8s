#!/usr/bin/env bash
set -euo pipefail

# Scale the API deployment manually
# Usage: ./scale-deployment.sh <replicas>
REPLICAS=${1:-3}
kubectl scale deployment/nexusnet-api --replicas="$REPLICAS"
kubectl get deployment nexusnet-api -o wide
