#!/usr/bin/env bash
set -euo pipefail

# Distribute kubeconfig produced by create-sa-kubeconfig.sh to a list of hosts and optionally add /etc/hosts entry
# Usage: ./scripts/distribute-kubeconfig.sh HOSTS_FILE SERVER_IP DOMAIN [KUBECONFIG]
# HOSTS_FILE: file with lines like user@host or host (if host only, current user will be used)

HOSTS_FILE=${1:-}
SERVER_IP=${2:-}
DOMAIN=${3:-}
KUBECONFIG_PATH=${4:-/tmp/nexusnet-client-kubeconfig.yaml}

if [[ -z "$HOSTS_FILE" || -z "$SERVER_IP" || -z "$DOMAIN" ]]; then
  echo "Usage: $0 HOSTS_FILE SERVER_IP DOMAIN [KUBECONFIG]" >&2
  exit 2
fi

if [[ ! -f "$KUBECONFIG_PATH" ]]; then
  echo "kubeconfig not found: $KUBECONFIG_PATH" >&2
  exit 3
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  hostline=$(echo "$line" | sed 's/#.*//' | tr -d '\r' | xargs)
  if [[ -z "$hostline" ]]; then
    continue
  fi
  if [[ "$hostline" == *@* ]]; then
    user=${hostline%@*}
    host=${hostline#*@}
  else
    user=${USER}
    host=$hostline
  fi

  echo "-> Distributing to $user@$host"
  ssh -o BatchMode=yes -o ConnectTimeout=10 "$user@$host" "mkdir -p ~/.kube && chmod 700 ~/.kube" || { echo "ssh to $user@$host failed"; continue; }
  scp -q "$KUBECONFIG_PATH" "$user@$host:~/.kube/config" || { echo "scp to $user@$host failed"; continue; }
  ssh -o BatchMode=yes "$user@$host" "chmod 600 ~/.kube/config && chown $user:$user ~/.kube/config" || true

  echo "  Adding /etc/hosts entry on $host for $DOMAIN -> $SERVER_IP"
  ssh "$user@$host" "echo '$SERVER_IP $DOMAIN' | sudo tee -a /etc/hosts >/dev/null" || echo "  Warning: failed to append /etc/hosts on $host"

  echo "  Done: $user@$host"

done < "$HOSTS_FILE"

echo "All done. Verify by running 'kubectl --kubeconfig=~/.kube/config get nodes' on a client."