#!/usr/bin/env bash
# =============================================================================
# NexusNet — k3s SERVER (control-plane + full stack)
# =============================================================================
#
# Uso:
#   DOMAIN=nexusnet.test ./setup-server.sh
#   DOMAIN=nexusnet.test METALLB_RANGE="192.168.1.240-192.168.1.250" ./setup-server.sh
#
# Variables de entorno (opcionales):
#   METALLB_RANGE     Rango de IPs para MetalLB (ej. "192.168.1.200-192.168.1.220")
#   REGISTRY_HOST     Registry externo para pushear imágenes (ej. "192.168.1.10:5000")
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
#   NGROK_URL / NGROK_AUTHTOKEN
#
# IMPORTANTE: ejecutar como usuario normal (con sudo disponible), NO como root.
# =============================================================================

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}══ $* ${NC}"; }

# ── Guardia: no ejecutar como root ────────────────────────────────────────────
if [[ "$EUID" -eq 0 ]]; then
  error "No ejecutes este script como root. Úsalo como usuario normal con sudo disponible."
fi

# ── Variables ─────────────────────────────────────────────────────────────────
DOMAIN=${DOMAIN:-}
METALLB_RANGE=${METALLB_RANGE:-}
REGISTRY_HOST=${REGISTRY_HOST:-}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFESTS_DIR="$SCRIPT_DIR/manifests"
FRONTEND_SRC="$SCRIPT_DIR/nexusnet"
BACKEND_SRC="$SCRIPT_DIR/nexusnet-backend"
KUBECONFIG=/etc/rancher/k3s/k3s.yaml
TOKEN_FILE=/var/lib/rancher/k3s/server/node-token

ensure_local_registry() {
  local registry_name="nexusnet-registry"
  local registry_port="5000"

  if docker ps --format '{{.Names}}' | grep -qx "$registry_name"; then
    info "Registry local ya está corriendo: ${SERVER_IP}:${registry_port}"
    return 0
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "$registry_name"; then
    info "Reiniciando registry local existente..."
    docker start "$registry_name" >/dev/null
  else
    info "Levantando registry local en ${SERVER_IP}:${registry_port}..."
    docker run -d \
      --restart=always \
      --name "$registry_name" \
      -p "${registry_port}:5000" \
      registry:2 >/dev/null
  fi

  success "Registry local listo en ${SERVER_IP}:${registry_port}"
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat << 'EOF'
  _   _                      _   _      _
 | \ | | _____  ___   _ ___ | \ | | ___| |_
 |  \| |/ _ \ \/ / | | / __||  \| |/ _ \ __|
 | |\  |  __/>  <| |_| \__ \| |\  |  __/ |_
 |_| \_|\___/_/\_\\__,_|___/|_| \_|\___|\___|

     k3s SERVER — Multi-host Cluster Setup
EOF
echo -e "${NC}"
echo -e "  Dominio    : ${BOLD}${DOMAIN:-<requerido>}${NC}"
echo -e "  MetalLB    : ${BOLD}${METALLB_RANGE:-no configurado}${NC}"
echo -e "  Registry   : ${BOLD}${REGISTRY_HOST:-local (solo nodo servidor)}${NC}"
echo -e "  Backend    : ${BOLD}$BACKEND_SRC${NC}"
echo -e "  Frontend   : ${BOLD}$FRONTEND_SRC${NC}"
echo ""

# ── 1. Validaciones ───────────────────────────────────────────────────────────
step "1/8 Verificando prerequisitos"

[[ -z "$DOMAIN" ]] && error "DOMAIN es obligatorio. Ej: DOMAIN=nexusnet.test ./setup-server.sh"
[[ -d "$MANIFESTS_DIR" ]] || error "No se encontró: $MANIFESTS_DIR"
[[ -d "$BACKEND_SRC"  ]] || error "Backend no encontrado: $BACKEND_SRC"
[[ -d "$FRONTEND_SRC" ]] || error "Frontend no encontrado: $FRONTEND_SRC"

command -v curl   &>/dev/null || error "curl no instalado"
command -v docker &>/dev/null || error "docker no instalado → https://docs.docker.com/get-docker/"
docker info &>/dev/null       || error "Docker no está corriendo. Inícialo primero."
success "Docker corriendo"

# kubectl puede no existir aún antes de instalar k3s — lo verificamos después
mkdir -p "$HOME/.kube"

if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GITHUB_CLIENT_ID:-}" ]]; then
  warn "Faltan credenciales OAuth — Google/GitHub login no funcionarán."
  warn "Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET."
fi

# Normalizar dominio
if [[ "$DOMAIN" =~ ^https?:// ]]; then
  DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"
fi
SITE_URL="http://${DOMAIN}"
PUBLIC_URL="${NGROK_URL:-${FRONTEND_URL:-$SITE_URL}}"
FRONTEND_URL="${FRONTEND_URL:-$PUBLIC_URL}"
OAUTH_CALLBACK_BASE_URL="${OAUTH_CALLBACK_BASE_URL:-$PUBLIC_URL}"

escape_sed() { printf '%s' "$1" | sed 's/[&|\\]/\\&/g'; }

# ── 2. Instalar k3s server ────────────────────────────────────────────────────
step "2/8 Instalando k3s server"

if command -v k3s &>/dev/null && systemctl is-active --quiet k3s 2>/dev/null; then
  info "k3s server ya está corriendo — se reutiliza."
else
  info "Descargando e instalando k3s server..."
  curl -sfL https://get.k3s.io | sudo sh -s - server \
    --write-kubeconfig-mode 644 \
    --tls-san "$DOMAIN" \
    --disable traefik

  # Esperar a que el API esté listo
  info "Esperando que k3s API esté disponible..."
  for i in {1..90}; do
    if sudo kubectl --kubeconfig="$KUBECONFIG" get nodes &>/dev/null; then
      success "k3s API accesible"
      break
    fi
    [[ $i -eq 90 ]] && error "k3s no respondió tras 90s. Revisa: sudo journalctl -u k3s -n 50"
    echo -n "."
    sleep 2
  done
fi

export KUBECONFIG="$KUBECONFIG"

# Leer token para agents
TOKEN=$(sudo cat "$TOKEN_FILE" 2>/dev/null) || error "No se pudo leer el token de k3s: $TOKEN_FILE"
SERVER_IP=$(hostname -I | awk '{print $1}')
success "Token listo. IP del server: $SERVER_IP"

# ── 3. Traefik ────────────────────────────────────────────────────────────────
step "3/8 Instalando Traefik Ingress Controller"

info "Aplicando manifest de Traefik..."
kubectl apply -f "$MANIFESTS_DIR/03-traefik.yaml"

info "Esperando rollout de Traefik (hasta 600s)..."
if kubectl rollout status deployment/traefik -n traefik --timeout=600s 2>/dev/null; then
  success "Traefik listo"
else
  error "Traefik no respondió tras 600s. Revisa: kubectl -n traefik describe deployment traefik"
fi

# ── 4. MetalLB (opcional) ─────────────────────────────────────────────────────
if [[ -n "$METALLB_RANGE" ]]; then
  step "4/8 Instalando MetalLB (rango: $METALLB_RANGE)"

  kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.12/config/manifests/metallb-native.yaml

  info "Esperando webhooks de MetalLB (60s)..."
  sleep 10
  kubectl wait --namespace metallb-system \
    --for=condition=ready pod \
    --selector=app=metallb \
    --timeout=60s 2>/dev/null || warn "MetalLB pods tardando, continuando..."

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
else
  step "4/8 MetalLB — omitido (no se definió METALLB_RANGE)"
  info "Traefik usará NodePort o HostPort para exponer servicios."
fi

# ── 5. Build imágenes Docker ──────────────────────────────────────────────────
step "5/8 Construyendo imágenes Docker"

info "Backend (nexusnet-api:local)..."
docker build \
  -t nexusnet-api:local \
  -f "$BACKEND_SRC/docker/Dockerfile.prod" \
  "$BACKEND_SRC"
success "nexusnet-api:local lista"

info "Frontend (nexusnet-frontend:local, VITE_API_URL=$PUBLIC_URL)..."
docker build \
  -t nexusnet-frontend:local \
  --build-arg VITE_API_URL="$PUBLIC_URL" \
  "$FRONTEND_SRC"
success "nexusnet-frontend:local lista"

# Importar imágenes en el containerd de k3s (así están disponibles localmente)
info "Importando imágenes en k3s containerd..."
for img in nexusnet-api:local nexusnet-frontend:local; do
  docker save "$img" | sudo k3s ctr images import -
done
success "Imágenes importadas en k3s"

# Push a registry externo o local (necesario para que los nodos worker las usen)
if [[ -z "$REGISTRY_HOST" ]]; then
  REGISTRY_HOST="${SERVER_IP}:5000"
  ensure_local_registry
fi

if [[ -n "$REGISTRY_HOST" ]]; then
  info "Pusheando imágenes a registry: $REGISTRY_HOST"
  docker tag nexusnet-api:local      "$REGISTRY_HOST/nexusnet-api:latest"
  docker tag nexusnet-frontend:local "$REGISTRY_HOST/nexusnet-frontend:latest"
  docker push "$REGISTRY_HOST/nexusnet-api:latest"      || warn "Fallo al pushear API"
  docker push "$REGISTRY_HOST/nexusnet-frontend:latest" || warn "Fallo al pushear frontend"
  success "Imágenes disponibles en $REGISTRY_HOST"
fi

# ── 6. Manifests Kubernetes ───────────────────────────────────────────────────
step "6/8 Aplicando manifests Kubernetes"

# Storage, Postgres, Redis, Traefik extras
info "Storage, PostgreSQL, Redis..."
for manifest in "$MANIFESTS_DIR"/0[1-3]*.yaml; do
  kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
done

# Secrets con sustitución de variables
info "Secrets (con dominio: $DOMAIN)..."
sed \
  -e "s|__DOMAIN__|$(escape_sed "$DOMAIN")|g" \
  -e "s|__FRONTEND_URL__|$(escape_sed "$FRONTEND_URL")|g" \
  -e "s|__OAUTH_CALLBACK_BASE_URL__|$(escape_sed "$OAUTH_CALLBACK_BASE_URL")|g" \
  -e "s|__GITHUB_CLIENT_ID__|$(escape_sed "${GITHUB_CLIENT_ID:-}")|g" \
  -e "s|__GITHUB_CLIENT_SECRET__|$(escape_sed "${GITHUB_CLIENT_SECRET:-}")|g" \
  -e "s|__GOOGLE_CLIENT_ID__|$(escape_sed "${GOOGLE_CLIENT_ID:-}")|g" \
  -e "s|__GOOGLE_CLIENT_SECRET__|$(escape_sed "${GOOGLE_CLIENT_SECRET:-}")|g" \
  "$MANIFESTS_DIR/04-secrets.yaml" | kubectl apply -f -

# Backend y Frontend
info "Backend, Frontend..."
for manifest in "$MANIFESTS_DIR"/0[5-6]*.yaml; do
  kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
done

# HPA y RBAC
info "Escalado y RBAC..."
for manifest in "$MANIFESTS_DIR"/08*.yaml; do
  kubectl apply -f "$manifest" 2>&1 | grep -v "Warning:" || true
done

# Stack de observabilidad y DR
info "Vault, Monitoreo, Disaster Recovery..."
kubectl apply -f "$MANIFESTS_DIR/10-vault-secrets.yaml"   2>&1 | grep -v "Warning:" || true
kubectl apply -f "$MANIFESTS_DIR/11-monitoring-stack.yaml" 2>&1 | grep -v "Warning:" || true
kubectl apply -f "$MANIFESTS_DIR/12-disaster-recovery.yaml" 2>&1 | grep -v "Warning:" || true

[[ -f "$MANIFESTS_DIR/14-resilience-auditor.yaml" ]] && \
  kubectl apply -f "$MANIFESTS_DIR/14-resilience-auditor.yaml" 2>&1 | grep -v "Warning:" || true

# Ingress consolidado
info "Creando Ingress consolidado..."
cat <<EOF | kubectl apply -f -
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexusnet-consolidated-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: traefik
    traefik.ingress.kubernetes.io/affinity: "true"
    traefik.ingress.kubernetes.io/session-cookie-name: "nexusnet_sticky"
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
          - path: /health
            pathType: Prefix
            backend:
              service:
                name: nexusnet-api
                port:
                  number: 3000
          - path: /docs
            pathType: Prefix
            backend:
              service:
                name: nexusnet-api
                port:
                  number: 3000
          - path: /resilience
            pathType: Prefix
            backend:
              service:
                name: resilience-auditor
                port:
                  number: 8081
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nexusnet-frontend
                port:
                  number: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: monitoring
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: "$DOMAIN"
      http:
        paths:
          - path: /grafana
            pathType: Prefix
            backend:
              service:
                name: grafana
                port:
                  number: 3000
          - path: /prometheus
            pathType: Prefix
            backend:
              service:
                name: prometheus
                port:
                  number: 9090
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vault-ingress
  namespace: vault
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
    - host: "$DOMAIN"
      http:
        paths:
          - path: /vault
            pathType: Prefix
            backend:
              service:
                name: vault
                port:
                  number: 8200
EOF
success "Ingress consolidado creado"

# ── 7. Esperas y migraciones ──────────────────────────────────────────────────
step "7/8 Esperando servicios y migraciones"

wait_statefulset() {
  local name=$1 min=${2:-1} timeout=${3:-300}
  local deadline=$(( $(date +%s) + timeout ))
  info "Esperando StatefulSet/$name (min $min pods ready, timeout ${timeout}s)..."
  while true; do
    local ready
    ready=$(kubectl get statefulset "$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
    ready=${ready:-0}
    (( ready >= min )) && { echo ""; success "$name listo ($ready pods)"; return 0; }
    (( $(date +%s) >= deadline )) && { echo ""; warn "Timeout esperando $name — continuando"; return 0; }
    echo -n "."
    sleep 5
  done
}

wait_postgres_tcp() {
  local timeout=${1:-300}
  local deadline=$(( $(date +%s) + timeout ))
  info "Verificando que postgres-0 acepte conexiones..."
  while true; do
    kubectl exec postgres-0 -- pg_isready -U postgres -q 2>/dev/null && \
      { echo ""; success "PostgreSQL listo"; return 0; }
    (( $(date +%s) >= deadline )) && { echo ""; warn "pg_isready timeout — continuando"; return 0; }
    echo -n "."
    sleep 5
  done
}

run_migrations() {
  local max=5 attempt=1
  info "Ejecutando migraciones Prisma (hasta $max intentos)..."
  while (( attempt <= max )); do
    kubectl delete pod prisma-migrate --ignore-not-found=true --wait=true 2>/dev/null || true
    API_POD=$(kubectl get pods -l app=nexusnet-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [[ -n "$API_POD" ]]; then
      if kubectl exec "$API_POD" -- sh -c \
        "cd /app && (npx prisma migrate deploy || npx prisma db push --accept-data-loss) && echo MIGRATION_OK" \
        2>&1 | grep -q "MIGRATION_OK"; then
        success "Migraciones aplicadas"
        return 0
      fi
    fi
    warn "Intento $attempt falló. Esperando 15s..."
    sleep 15
    (( attempt++ ))
  done
  warn "Migraciones fallaron. Corre manualmente:"
  warn "  kubectl exec -it \$(kubectl get pod -l app=nexusnet-api -o jsonpath='{.items[0].metadata.name}') -- sh -c 'cd /app && npx prisma migrate deploy'"
}

wait_statefulset "postgres"     1 120
wait_postgres_tcp                 90
wait_statefulset "redis-master" 1  90
run_migrations

info "Esperando Deployment nexusnet-api (hasta 300s)..."
kubectl rollout status deployment/nexusnet-api --timeout=300s && success "nexusnet-api listo" || warn "nexusnet-api tardando"

info "Esperando Deployment nexusnet-frontend (hasta 120s)..."
kubectl rollout status deployment/nexusnet-frontend --timeout=120s && success "nexusnet-frontend listo" || warn "nexusnet-frontend tardando"

# ── 8. Kubernetes Dashboard ───────────────────────────────────────────────────
step "8/8 Instalando Kubernetes Dashboard"

kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml
kubectl wait \
  --namespace kubernetes-dashboard \
  --for=condition=ready pod \
  -l k8s-app=kubernetes-dashboard \
  --timeout=120s \
  && success "Dashboard listo" \
  || warn "Dashboard tardando — continúa de todas formas"

[[ -f "$MANIFESTS_DIR/09-dashboard-rbac.yaml" ]] && \
  kubectl apply -f "$MANIFESTS_DIR/09-dashboard-rbac.yaml"

DASHBOARD_TOKEN=$(
  kubectl get secret nexusnet-admin-token \
    -n kubernetes-dashboard \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 --decode \
  || kubectl create token nexusnet-admin -n kubernetes-dashboard 2>/dev/null \
  || echo "<ejecuta: kubectl create token nexusnet-admin -n kubernetes-dashboard>"
)

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅  NexusNet k3s SERVER desplegado exitosamente${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Cluster info:${NC}"
echo -e "  IP del servidor : ${CYAN}$SERVER_IP${NC}"
echo -e "  Dominio         : ${CYAN}$DOMAIN${NC}"
echo -e "  kubeconfig      : ${CYAN}$KUBECONFIG${NC}"
echo ""
echo -e "${BOLD}Para unir nodos WORKER — en cada worker ejecuta:${NC}"
echo ""
echo -e "  ${CYAN}DOMAIN=$DOMAIN SERVER_IP=$SERVER_IP TOKEN=$TOKEN ./setup-node.sh${NC}"
echo ""
echo -e "${BOLD}O con el script original:${NC}"
echo -e "  ${CYAN}./setup-k3s-multihost.sh agent $SERVER_IP $TOKEN${NC}"
echo ""
echo -e "${BOLD}Acceso a la aplicación:${NC}"
echo -e "  🌐 App        → ${CYAN}$SITE_URL${NC}"
echo -e "  🔌 API        → ${CYAN}$SITE_URL/api/v1${NC}"
echo -e "  📖 Swagger    → ${CYAN}$SITE_URL/docs${NC}"
echo -e "  ❤️  Health     → ${CYAN}$SITE_URL/health${NC}"
echo -e "  📊 Grafana    → ${CYAN}$SITE_URL/grafana${NC}"
echo -e "  📈 Prometheus → ${CYAN}$SITE_URL/prometheus${NC}"
echo -e "  🔒 Vault      → ${CYAN}$SITE_URL/vault${NC}"
echo -e "  🧪 Resilience → ${CYAN}$SITE_URL/resilience/report${NC}"
echo ""
echo -e "${BOLD}DNS local — agrega en /etc/hosts de cada cliente:${NC}"
echo -e "  ${CYAN}sudo sh -c 'echo \"$SERVER_IP $DOMAIN\" >> /etc/hosts'${NC}"
echo ""
echo -e "${BOLD}Estado del cluster:${NC}"
kubectl get nodes
echo ""
kubectl get pods -A --no-headers | awk '{printf "  %-50s %-12s %s\n", $2, $4, $5}'
echo ""
echo -e "${BOLD}Kubernetes Dashboard:${NC}"
echo -e "  1. En otra terminal: ${CYAN}sudo kubectl proxy --kubeconfig=$KUBECONFIG${NC}"
echo -e "  2. Abre: ${CYAN}http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/${NC}"
echo -e "  3. Token: ${YELLOW}${DASHBOARD_TOKEN}${NC}"
echo ""

# Guardar el token y datos del server en un archivo para referencia
cat > "$SCRIPT_DIR/.cluster-info" << CLUSTEREOF
# Generado por setup-server.sh — $(date)
SERVER_IP=$SERVER_IP
TOKEN=$TOKEN
DOMAIN=$DOMAIN
REGISTRY_HOST=$REGISTRY_HOST
KUBECONFIG=$KUBECONFIG
CLUSTEREOF
success "Info del cluster guardada en .cluster-info"
echo ""
