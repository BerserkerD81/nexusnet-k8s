#!/usr/bin/env bash
set -euo pipefail

# Stop or delete AKS cluster
# Usage: ./shutdown-cluster.sh <RESOURCE_GROUP> <AKS_NAME>
RG=${1:-nexusnet-rg}
AKS=${2:-nexusnet-aks}

read -r -p "Stop AKS (stops all nodes, retains resources) or delete AKS? [stop/delete]: " MODE
if [ "$MODE" = "stop" ]; then
  az aks stop -g "$RG" -n "$AKS"
  echo "AKS stopped (you can restart with 'az aks start')"
else
  az aks delete -g "$RG" -n "$AKS" --yes
  echo "AKS deleted"
fi
