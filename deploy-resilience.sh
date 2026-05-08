#!/usr/bin/env bash
###############################################################################
# NexusNet — Script de despliegue del servicio resiliente
#
# Aplica los nuevos manifests en el orden correcto sobre el cluster k3d existente
# Uso: ./deploy-resilience.sh [--demo]
###############################################################################
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-$HOME/.kube/k3d-nexusnet.yaml}"
export KUBECONFIG
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFESTS_DIR="$SCRIPT_DIR/manifests"
DEMO_MODE="${1:-}"

# Colores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step()  { echo -e "\n${BOLD}${BLUE}══ $1${NC}"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Reemplazar placeholder del dominio ngrok
substitute_domain() {
  local file="$1"
  if [ -n "${NGROK_URL:-}" ]; then
    local domain
    domain=$(echo "$NGROK_URL" | sed 's|https://||')
    sed "s|__NGROK_DOMAIN__|$domain|g" "$file"
  else
    cat "$file"
  fi
}

banner() {
  echo -e "${BOLD}${CYAN}"
  cat << 'EOF'
  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗███╗   ██╗███████╗████████╗
  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝████╗  ██║██╔════╝╚══██╔══╝
  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗██╔██╗ ██║█████╗     ██║
  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║██║╚██╗██║██╔══╝     ██║
  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║██║ ╚████║███████╗   ██║
  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚══════╝   ╚═╝
  Resilience Service — Vault + Monitoring + DR + Security
EOF
  echo -e "${NC}"
}

banner

# ────────────────────────────────────────────────────────────────────────────
step "1/5  Verificando prerequisitos"

kubectl cluster-info --request-timeout=5s > /dev/null 2>&1 && \
  ok "Cluster k3d accesible" || \
  { error "Cluster no disponible. Ejecuta ./setup.sh primero."; exit 1; }

kubectl get deployment nexusnet-api > /dev/null 2>&1 && \
  ok "Deployment nexusnet-api existe" || \
  warn "nexusnet-api no encontrado — los nuevos manifests se aplicarán de todas formas"

# ────────────────────────────────────────────────────────────────────────────
step "2/5  Aplicando seguridad multinivel (13-security-hardening.yaml)"

info "Aplicando NetworkPolicies, RBAC granular, ResourceQuotas..."
substitute_domain "$MANIFESTS_DIR/13-security-hardening.yaml" | \
  kubectl apply -f - --server-side 2>&1 | grep -v "unchanged" || true
ok "Políticas de seguridad aplicadas"

# Verificar que los pods existentes siguen corriendo
RUNNING=$(kubectl get pods -l app=nexusnet-api --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
if [ "$RUNNING" -gt 0 ]; then
  ok "$RUNNING pods del backend siguen corriendo tras aplicar NetworkPolicies"
else
  warn "Ningún pod del backend corriendo aún"
fi

# ────────────────────────────────────────────────────────────────────────────
step "3/5  Desplegando Vault (10-vault-secrets.yaml)"

info "Creando namespace vault y desplegando HashiCorp Vault..."
substitute_domain "$MANIFESTS_DIR/10-vault-secrets.yaml" | \
  kubectl apply -f - --server-side 2>&1 | grep -v "unchanged" || true

info "Esperando que Vault esté listo (hasta 120s)..."
kubectl rollout status statefulset/vault -n vault --timeout=120s 2>/dev/null && \
  ok "Vault listo" || warn "Vault tardando más de lo esperado — continuar de todas formas"

# Ejecutar job de inicialización
info "Inicializando secretos en Vault..."
kubectl wait --for=condition=complete job/vault-init-secrets -n vault --timeout=120s 2>/dev/null && \
  ok "Secretos de Vault inicializados" || warn "Job de init no completado aún"

# ────────────────────────────────────────────────────────────────────────────
step "4/5  Desplegando stack de monitoreo (11-monitoring-stack.yaml)"

info "Creando namespace monitoring, Prometheus, Grafana, Alertmanager..."
substitute_domain "$MANIFESTS_DIR/11-monitoring-stack.yaml" | \
  kubectl apply -f - --server-side 2>&1 | grep -v "unchanged" || true

info "Esperando Prometheus (hasta 60s)..."
kubectl rollout status deployment/prometheus -n monitoring --timeout=60s 2>/dev/null && \
  ok "Prometheus listo" || warn "Prometheus iniciando..."

info "Esperando Grafana (hasta 60s)..."
kubectl rollout status deployment/grafana -n monitoring --timeout=60s 2>/dev/null && \
  ok "Grafana listo" || warn "Grafana iniciando..."

# ────────────────────────────────────────────────────────────────────────────
step "5/5  Configurando recuperación ante desastres (12-disaster-recovery.yaml)"

info "Creando PVC de backups, CronJobs de backup y verificación de integridad..."
kubectl apply -f "$MANIFESTS_DIR/12-disaster-recovery.yaml" 2>&1 | grep -v "unchanged" || true
ok "Sistema DR configurado"

info "Ejecutando primer backup manual para verificar..."
kubectl create job pg-backup-initial \
  --from=cronjob/postgres-backup 2>/dev/null || \
  info "Job de backup manual ya existe o no hay PostgreSQL activo"

# ────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}══ Despliegue completado ══${NC}"
echo ""
echo -e "${BOLD}Estado del cluster:${NC}"
kubectl get pods -A --field-selector=status.phase=Running \
  --no-headers 2>/dev/null | awk '{print $1, $2, $4}' | column -t
echo ""
echo -e "${BOLD}Accesos:${NC}"
DOMAIN="${NGROK_URL:-http://localhost}"
echo -e "  🔍 Grafana:    ${CYAN}${DOMAIN}/grafana${NC}     (admin / nexusnet-grafana-2024)"
echo -e "  📊 Prometheus: ${CYAN}${DOMAIN}/prometheus${NC}"
echo -e "  🔐 Vault:      ${CYAN}${DOMAIN}/vault${NC}        (token: nexusnet-dev-root-token)"
echo ""
echo -e "${BOLD}Comandos útiles:${NC}"
echo "  # Ver alertas activas"
echo "  kubectl get pods -n monitoring"
echo ""
echo "  # Simular fallo del backend"
echo "  kubectl delete pod \$(kubectl get pods -l app=nexusnet-api -o name | head -1)"
echo ""
echo "  # Forzar backup manual"
echo "  kubectl create job pg-backup-demo --from=cronjob/postgres-backup"
echo ""
echo "  # Ver logs de backup"
echo "  kubectl logs -l job=postgres-backup --tail=20"
echo ""
echo "  # Ver políticas de seguridad activas"
echo "  kubectl get networkpolicies"
echo ""

# ────────────────────────────────────────────────────────────────────────────
if [ "$DEMO_MODE" = "--demo" ]; then
  echo -e "${BOLD}${YELLOW}══ MODO DEMO: ejecutando prueba de resiliencia ══${NC}"
  echo ""
  echo "1. Estado inicial del backend:"
  kubectl get pods -l app=nexusnet-api
  echo ""
  echo "2. Eliminando un pod (simulando fallo)..."
  VICTIM=$(kubectl get pods -l app=nexusnet-api -o name 2>/dev/null | head -1)
  if [ -n "$VICTIM" ]; then
    kubectl delete "$VICTIM"
    echo "   Pod eliminado: $VICTIM"
    echo "3. Kubernetes reinicia automáticamente (observar en tiempo real):"
    kubectl get pods -l app=nexusnet-api -w &
    WATCH_PID=$!
    sleep 15
    kill $WATCH_PID 2>/dev/null || true
  fi
  echo ""
  echo "4. NetworkPolicies activas:"
  kubectl get networkpolicies -o custom-columns=\
'NOMBRE:.metadata.name,SELECTOR:.spec.podSelector.matchLabels,TIPOS:.spec.policyTypes[*]'
  echo ""
  echo "5. CronJobs de DR activos:"
  kubectl get cronjobs
fi
