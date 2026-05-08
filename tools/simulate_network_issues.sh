#!/usr/bin/env bash
# Helper to simulate network issues by applying/deleting deny-all NetworkPolicy
# Usage:
#   ./simulate_network_issues.sh block grafana
#   ./simulate_network_issues.sh restore grafana
#   ./simulate_network_issues.sh block prometheus
#   ./simulate_network_issues.sh restore prometheus

set -euo pipefail
cmd=${1:-}
target=${2:-}

if [[ -z "$cmd" || -z "$target" ]]; then
  echo "Usage: $0 <block|restore> <grafana|prometheus|vault>"
  exit 2
fi

case "$target" in
  grafana)
    NS=monitoring
    LABEL_APP=grafana
    ;;
  prometheus)
    NS=monitoring
    LABEL_APP=prometheus
    ;;
  vault)
    NS=vault
    LABEL_APP=vault
    ;;
  *)
    echo "Unknown target: $target"; exit 2
    ;;
esac

POLICY_NAME=deny-all-ingress-${target}

if [[ "$cmd" == "block" ]]; then
  cat <<EOF | kubectl apply -n "$NS" -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: $POLICY_NAME
spec:
  podSelector:
    matchLabels:
      app: $LABEL_APP
  policyTypes:
    - Ingress
  ingress: []
EOF
  echo "Applied NetworkPolicy $POLICY_NAME in namespace $NS — ingress to pods with label app=$LABEL_APP is now denied"
  echo "To restore, run: ./tools/simulate_network_issues.sh restore $target"
  exit 0
fi

if [[ "$cmd" == "restore" ]]; then
  kubectl delete networkpolicy "$POLICY_NAME" -n "$NS" --ignore-not-found
  echo "Deleted NetworkPolicy $POLICY_NAME in namespace $NS — ingress restored (if no other policy blocks it)"
  exit 0
fi

echo "Unknown command: $cmd"; exit 2
