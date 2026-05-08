#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# Clean up k3d cluster
# Usage: ./k3d-cleanup.sh <CLUSTER_NAME>

CLUSTER=${1:-nexusnet}

echo "Deleting k3d cluster: $CLUSTER"
k3d cluster delete "$CLUSTER" || true
rm -f /tmp/k3d-"$CLUSTER".yaml

echo "Cluster deleted."
