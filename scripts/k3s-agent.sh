#!/usr/bin/env bash
set -euo pipefail

# k3s agent installer
# Usage: ./scripts/k3s-agent.sh SERVER_IP TOKEN

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 SERVER_IP TOKEN" >&2
  exit 2
fi

SERVER_IP=$1
TOKEN=$2

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required. Install it and retry." >&2
  exit 1
fi

echo "Joining k3s cluster at https://$SERVER_IP:6443"
export K3S_URL="https://$SERVER_IP:6443"
export K3S_TOKEN="$TOKEN"

curl -sfL https://get.k3s.io | K3S_URL="$K3S_URL" K3S_TOKEN="$K3S_TOKEN" sh -

echo "Agent installed. Check server: kubectl get nodes" 
