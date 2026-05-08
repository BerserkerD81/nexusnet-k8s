#!/usr/bin/env bash
set -euo pipefail

# k3s server installer for NexusNet multi-host setup
# Usage: ./scripts/k3s-server.sh [DOMAIN] [METALLB_IP_RANGE]

DOMAIN=${1:-}
METALLB_RANGE=${2:-}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required. Install it and retry." >&2
  exit 1
fi

echo "Installing k3s server..."
INSTALL_ARGS=("server" "--write-kubeconfig-mode" "644")
if [[ -n "$DOMAIN" ]]; then
  INSTALL_ARGS+=("--tls-san" "$DOMAIN")
fi

curl -sfL https://get.k3s.io | sh -s - ${INSTALL_ARGS[*]}

KUBECONFIG=/etc/rancher/k3s/k3s.yaml
echo "k3s installed. Kubeconfig: $KUBECONFIG"

TOKEN_FILE=/var/lib/rancher/k3s/server/node-token
if [[ -f "$TOKEN_FILE" ]]; then
  echo "Agent token available at: $TOKEN_FILE"
  echo "Token (short):" $(sudo cat $TOKEN_FILE | head -c 64)"..."
fi

# Optional: install MetalLB if METALLB_RANGE provided
if [[ -n "$METALLB_RANGE" ]]; then
  echo "Installing MetalLB..."
  kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml

  cat <<EOF | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: lan-pool
  namespace: metallb-system
spec:
  addresses:
  - ${METALLB_RANGE}
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: lan-adv
  namespace: metallb-system
spec: {}
EOF

  echo "MetalLB configured with range: $METALLB_RANGE"
fi

echo "Done. To join agents, run the agent script on each worker with SERVER_IP and TOKEN." 
echo "Example (on worker): ./scripts/k3s-agent.sh SERVER_IP $(sudo cat $TOKEN_FILE)"
