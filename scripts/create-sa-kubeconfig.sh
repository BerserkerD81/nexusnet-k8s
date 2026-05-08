#!/usr/bin/env bash
set -euo pipefail

# Create a service account with 'view' permissions and build a kubeconfig for distribution
# Usage: ./scripts/create-sa-kubeconfig.sh [NAMESPACE] [OUTPUT_PATH] [SA_NAME]

NAMESPACE=${1:-kube-system}
OUT=${2:-/tmp/nexusnet-client-kubeconfig.yaml}
SA_NAME=${3:-nexusnet-client}

echo "Using namespace=$NAMESPACE sa=$SA_NAME out=$OUT"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1 || true

kubectl create serviceaccount "$SA_NAME" -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl create clusterrolebinding "${SA_NAME}-view" --clusterrole=view --serviceaccount="${NAMESPACE}:${SA_NAME}" --dry-run=client -o yaml | kubectl apply -f -

echo "Obtaining token for $SA_NAME..."
TOKEN=""
# Prefer kubectl token command (available in newer kubectl). Fallback to reading the secret.
if kubectl -n "$NAMESPACE" version --client >/dev/null 2>&1 && kubectl -n "$NAMESPACE" create token "$SA_NAME" --duration=8760h >/dev/null 2>&1; then
  TOKEN=$(kubectl -n "$NAMESPACE" create token "$SA_NAME")
else
  # fallback: find a secret name that mentions the service account
  SECRET_NAME=$(kubectl -n "$NAMESPACE" get secret -o name | grep token | grep "$SA_NAME" | head -n1 | sed 's|secret/||' || true)
  if [[ -n "$SECRET_NAME" ]]; then
    TOKEN=$(kubectl -n "$NAMESPACE" get secret "$SECRET_NAME" -o jsonpath="{.data.token}" | base64 --decode)
  fi
fi

if [[ -z "$TOKEN" ]]; then
  echo "Failed to obtain token for $SA_NAME" >&2
  exit 1
fi

SERVER=$(kubectl config view --raw -o jsonpath="{.clusters[0].cluster.server}")
CA_DATA=$(kubectl config view --raw -o jsonpath="{.clusters[0].cluster.certificate-authority-data}")

cat > "$OUT" <<EOF
apiVersion: v1
kind: Config
clusters:
- name: nexusnet-cluster
  cluster:
    server: ${SERVER}
    certificate-authority-data: ${CA_DATA}
contexts:
- name: nexusnet-context
  context:
    cluster: nexusnet-cluster
    user: ${SA_NAME}
current-context: nexusnet-context
users:
- name: ${SA_NAME}
  user:
    token: ${TOKEN}
EOF

chmod 600 "$OUT"
echo "Wrote kubeconfig to $OUT (permission 600)."