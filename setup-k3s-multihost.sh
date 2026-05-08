#!/usr/bin/env bash
# =============================================================================
# NexusNet — k3s multi-host setup (server + agents)
# =============================================================================
#
# Uso en SERVIDOR PRINCIPAL:
#   DOMAIN=nexusnet.test ./setup-k3s-multihost.sh server
#
# Uso en NODOS TRABAJADORES:
#   ./setup-k3s-multihost.sh agent SERVER_IP TOKEN
#
# Ej:
#   En server: DOMAIN=nexusnet.test ./setup-k3s-multihost.sh server
#   En worker: ./setup-k3s-multihost.sh agent 192.168.1.10 K10a...token...
#
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}══ $* ${NC}"; }

check_cmd() {
  command -v "$1" &>/dev/null && success "$1 encontrado" \
    || error "$1 no instalado → $2"
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|\\]/\\&/g'
}

# ── Modo: server o agent ──────────────────────────────────────────────────────
MODE=${1:-}
case "$MODE" in
  server)
    step "Modo SERVER — instalando k3s server + MetalLB + aplicando manifests"
    ;;
  agent)
    if [[ $# -lt 3 ]]; then
      error "Modo agent requiere: $0 agent SERVER_IP TOKEN"
    fi
    SERVER_IP=$2
    TOKEN=$3
    step "Modo AGENT — uniéndose a server en $SERVER_IP"
    ;;
  *)
    echo "Uso: $0 {server|agent SERVER_IP TOKEN}" >&2
    exit 2
    ;;
esac

# ═════════════════════════════════════════════════════════════════════════════
# SERVIDOR PRINCIPAL
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "server" ]]; then

  DOMAIN=${DOMAIN:-}
  METALLB_RANGE=${METALLB_RANGE:-}
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  MANIFESTS_DIR="$SCRIPT_DIR/manifests"
  FRONTEND_SRC="$SCRIPT_DIR/nexusnet"
  BACKEND_SRC="$SCRIPT_DIR/nexusnet-backend"

  # ── 1. Prerequisitos ──────────────────────────────────────────────────────
  step "1/5 Verificando prerequisitos"

  check_cmd curl   "instala curl"
  check_cmd docker "https://docs.docker.com/get-docker/"
  check_cmd kubectl "https://kubernetes.io/docs/tasks/tools/"

  docker info &>/dev/null || error "Docker no está corriendo. Inícialo primero."
  success "Docker corriendo"

  [[ -d "$MANIFESTS_DIR" ]] || error "No se encontró: $MANIFESTS_DIR"
  [[ -d "$BACKEND_SRC"  ]] || error "Backend no encontrado: $BACKEND_SRC"
  [[ -d "$FRONTEND_SRC" ]] || error "Frontend no encontrado: $FRONTEND_SRC"

  if [[ -z "$DOMAIN" ]]; then
    error "DOMAIN es obligatorio. Uso: DOMAIN=nexusnet.test ./setup-k3s-multihost.sh server"
  fi

  mkdir -p "$HOME/.kube"

  # ── 2. Instalar k3s server ────────────────────────────────────────────────
  step "2/5 Instalando k3s server"

  if command -v k3s >/dev/null 2>&1; then
    info "k3s ya está instalado"
  else
    info "Descargando e instalando k3s..."
    curl -sfL https://get.k3s.io | sh -s - server \
      --write-kubeconfig-mode 644 \
      --tls-san "$DOMAIN" \
      --disable traefik
    success "k3s server instalado"
  fi

  # Esperar a que k3s esté listo
  info "Esperando que k3s server esté listo..."
  for i in {1..60}; do
    if kubectl get nodes &>/dev/null; then
      success "k3s API accesible"
      break
    fi
    if [[ $i -eq 60 ]]; then
      error "k3s no está listo tras 60s"
    fi
    echo -n "."
    sleep 1
  done

  # Configurar kubeconfig local
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
  success "kubeconfig: $KUBECONFIG"

  # Mostrar token para agents
  TOKEN_FILE=/var/lib/rancher/k3s/server/node-token
  TOKEN=$(sudo cat "$TOKEN_FILE" 2>/dev/null || echo "")
  if [[ -z "$TOKEN" ]]; then
    error "No se pudo leer el token de k3s"
  fi
  info "Token para agents: $TOKEN"

  # ── 3. Instalar Traefik + MetalLB ─────────────────────────────────────────
  step "3/5 Instalando Traefik + MetalLB"

  # Traefik (desde manifests)
  info "Aplicando Traefik..."
  kubectl apply -f "$MANIFESTS_DIR/03-traefik.yaml" || true
  info "Esperando rollout de Traefik..."
  kubectl rollout status deployment/traefik -n traefik --timeout=300s 2>/dev/null || warn "Traefik tardó, continuando..."

  # MetalLB
  if [[ -n "$METALLB_RANGE" ]]; then
    info "Instalando MetalLB..."
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
    success "MetalLB configurado con rango: $METALLB_RANGE"
  fi

  # ── 4. Construir imágenes ─────────────────────────────────────────────────
  step "4/5 Construyendo imágenes Docker"

  info "Backend (nexusnet-api:local)..."
  docker build \
    -t nexusnet-api:local \
    -f "$BACKEND_SRC/docker/Dockerfile.prod" \
    "$BACKEND_SRC" 2>&1 | tail -5
  success "nexusnet-api:local lista"

  info "Frontend (nexusnet-frontend:local)..."
  docker build \
    -t nexusnet-frontend:local \
    --build-arg VITE_API_URL="http://$DOMAIN" \
    "$FRONTEND_SRC" 2>&1 | tail -5
  success "nexusnet-frontend:local lista"

  # ── Opcional: push a registry local ────────────────────────────────────────
  # Si existe un registry, pushear imágenes allí
  REGISTRY_HOST=${REGISTRY_HOST:-}
  if [[ -n "$REGISTRY_HOST" ]]; then
    info "Pusheando imágenes a registry: $REGISTRY_HOST"
    docker tag nexusnet-api:local "$REGISTRY_HOST/nexusnet-api:latest"
    docker tag nexusnet-frontend:local "$REGISTRY_HOST/nexusnet-frontend:latest"
    docker push "$REGISTRY_HOST/nexusnet-api:latest" || warn "Fallo al pushear API"
    docker push "$REGISTRY_HOST/nexusnet-frontend:latest" || warn "Fallo al pushear frontend"
    success "Imágenes pusheadas"
  fi

  # ── 5. Aplicar manifests ──────────────────────────────────────────────────
  step "5/5 Aplicando manifests Kubernetes"

  info "Aplicando Storage, PostgreSQL, Redis..."
  for manifest in "$MANIFESTS_DIR"/0[1-3]*.yaml; do
    kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
  done

  info "Aplicando Secrets..."
  FRONTEND_URL="http://$DOMAIN"
  OAUTH_CALLBACK_BASE_URL="http://$DOMAIN"
  GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
  GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

  sed \
    -e "s|__DOMAIN__|$(escape_sed_replacement "$DOMAIN")|g" \
    -e "s|__FRONTEND_URL__|$(escape_sed_replacement "$FRONTEND_URL")|g" \
    -e "s|__OAUTH_CALLBACK_BASE_URL__|$(escape_sed_replacement "$OAUTH_CALLBACK_BASE_URL")|g" \
    -e "s|__GITHUB_CLIENT_ID__|$(escape_sed_replacement "$GITHUB_CLIENT_ID")|g" \
    -e "s|__GITHUB_CLIENT_SECRET__|$(escape_sed_replacement "$GITHUB_CLIENT_SECRET")|g" \
    -e "s|__GOOGLE_CLIENT_ID__|$(escape_sed_replacement "$GOOGLE_CLIENT_ID")|g" \
    -e "s|__GOOGLE_CLIENT_SECRET__|$(escape_sed_replacement "$GOOGLE_CLIENT_SECRET")|g" \
    "$MANIFESTS_DIR/04-secrets.yaml" | kubectl apply -f -

  info "Aplicando Backend, Frontend..."
  for manifest in "$MANIFESTS_DIR"/0[5-6]*.yaml; do
    kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
  done

  info "Aplicando escalado y RBAC..."
  for manifest in "$MANIFESTS_DIR"/08*.yaml; do
    kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
  done

  info "Aplicando stack de monitoreo..."
  kubectl apply -f "$MANIFESTS_DIR/10-vault-secrets.yaml" 2>&1 | grep -v "Warning:" || true
  kubectl apply -f "$MANIFESTS_DIR/11-monitoring-stack.yaml" 2>&1 | grep -v "Warning:" || true
  kubectl apply -f "$MANIFESTS_DIR/12-disaster-recovery.yaml" 2>&1 | grep -v "Warning:" || true

  # Ingress consolidado
  info "Creando Ingress consolidado..."
  cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexusnet-consolidated-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: traefik
    traefik.ingress.kubernetes.io/affinity: "true"
spec:
  rules:
    - host: "$DOMAIN"
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: nexusnet-api
                port:
                  number: 3000
          - path: /socket.io
            pathType: Prefix
            backend:
              service:
                name: nexusnet-api
                port:
                  number: 3000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nexusnet-frontend
                port:
                  number: 80
EOF

  # ── Resumen ───────────────────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  ✅  NexusNet k3s SERVER listo${NC}"
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BOLD}Servidor:${NC}"
  echo -e "  IP local (aprox): $(hostname -I | awk '{print $1}')"
  echo -e "  Domain: $DOMAIN"
  echo -e "  kubeconfig: $KUBECONFIG"
  echo ""
  echo -e "${BOLD}Para unir nodos WORKERS a este cluster:${NC}"
  echo -e "  En cada worker ejecuta:"
  echo -e "    ${CYAN}./setup-k3s-multihost.sh agent $(hostname -I | awk '{print $1}') $TOKEN${NC}"
  echo ""
  echo -e "${BOLD}Comandos útiles:${NC}"
  echo -e "  Ver nodos: ${CYAN}kubectl get nodes${NC}"
  echo -e "  Ver pods: ${CYAN}kubectl get pods -A${NC}"
  echo -e "  Logs: ${CYAN}kubectl logs -f deployment/nexusnet-api${NC}"
  echo ""
  echo -e "${BOLD}Acceso a la app:${NC}"
  echo -e "  Agrega a /etc/hosts en cada cliente:"
  echo -e "    ${CYAN}$(hostname -I | awk '{print $1}') $DOMAIN${NC}"
  echo -e "  Luego abre: ${CYAN}http://$DOMAIN${NC}"
  echo ""

# ═════════════════════════════════════════════════════════════════════════════
# NODO TRABAJADOR (AGENT)
# ═════════════════════════════════════════════════════════════════════════════
elif [[ "$MODE" == "agent" ]]; then

  step "Modo AGENT — uniéndose a $SERVER_IP"

  if ! command -v curl >/dev/null 2>&1; then
    error "curl es requerido"
  fi

  # Instalar k3s agent
  info "Instalando k3s agent..."
  export K3S_URL="https://$SERVER_IP:6443"
  export K3S_TOKEN="$TOKEN"

  curl -sfL https://get.k3s.io | sh -s - agent

  info "Esperando que el agent esté listo..."
  for i in {1..60}; do
    if kubectl get nodes &>/dev/null 2>&1; then
      success "Agent conectado"
      break
    fi
    if [[ $i -eq 60 ]]; then
      warn "Agent aún no está listo, pero el script continuó"
    fi
    echo -n "."
    sleep 1
  done

  echo ""
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  ✅  Nodo AGENT unido al cluster${NC}"
  echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "${BOLD}En el SERVER, verifica con:${NC}"
  echo -e "  ${CYAN}kubectl get nodes${NC}"
  echo ""

fi

exit 0
