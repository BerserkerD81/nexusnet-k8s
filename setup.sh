#!/usr/bin/env bash
# =============================================================================
# NexusNet — Local Kubernetes Setup (k3d + Traefik + Dashboard)
# =============================================================================
#
# Uso:
#   DOMAIN=mi-dominio.local ./setup.sh [CLUSTER_NAME] [WORKERS]
#   ./setup.sh [CLUSTER_NAME] [WORKERS] [DOMAIN]
#   ./setup.sh --reuse-cluster [CLUSTER_NAME] [WORKERS] [DOMAIN]
#
# Ej: DOMAIN=nexusnet.test ./setup.sh
#     ./setup.sh nexusnet 2 myapp.com
#     ./setup.sh --reuse-cluster nexusnet 2 myapp.com
#
# IMPORTANTE: ejecuta como tu usuario normal, NO con sudo.
# =============================================================================

set -euo pipefail

# Ejecutar en modo no interactivo por defecto (autónomo)
AUTO_MODE=${AUTO_MODE:-1}

RECREATE_CLUSTER=true
POSITIONAL_ARGS=()

while (($# > 0)); do
  case "$1" in
    --reuse-cluster|--keep-cluster|--no-delete)
      RECREATE_CLUSTER=false
      ;;
    --recreate-cluster)
      RECREATE_CLUSTER=true
      ;;
    -h|--help)
      cat << 'EOF'
Uso:
  DOMAIN=mi-dominio.local ./setup.sh [CLUSTER_NAME] [WORKERS]
  ./setup.sh [CLUSTER_NAME] [WORKERS] [DOMAIN]
  ./setup.sh --reuse-cluster [CLUSTER_NAME] [WORKERS] [DOMAIN]

Flags:
  --reuse-cluster     Reutiliza el cluster existente en lugar de borrarlo.
  --keep-cluster      Alias de --reuse-cluster.
  --no-delete         Alias de --reuse-cluster.
  --recreate-cluster  Fuerza el comportamiento por defecto de recrear el cluster.

Ej:
  DOMAIN=nexusnet.test ./setup.sh
  ./setup.sh --reuse-cluster nexusnet 2 myapp.com
EOF
      exit 0
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      ;;
  esac
  shift
done

set -- "${POSITIONAL_ARGS[@]}"

CLUSTER=${1:-nexusnet}
WORKERS=${2:-2}
DOMAIN=${3:-${DOMAIN:-}}
NGROK_SOURCE=""
# Soporta ngrok dev domain directo desde el entorno.
if [[ -z "${DOMAIN:-}" ]]; then
  if [[ -n "${NGROK_URL:-}" ]]; then
    DOMAIN="$NGROK_URL"
    NGROK_SOURCE="NGROK_URL"
  elif [[ -n "${NGROK_DOMAIN:-}" ]]; then
    DOMAIN="$NGROK_DOMAIN"
    NGROK_SOURCE="NGROK_DOMAIN"
  fi
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFESTS_DIR="$SCRIPT_DIR/manifests"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
# Kubeconfig en HOME del usuario — sin problemas de permisos
KUBECONFIG_PATH="$HOME/.kube/k3d-${CLUSTER}.yaml"

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

# ── Guardia: no ejecutar como root ────────────────────────────────────────────
if [[ "$EUID" -eq 0 ]]; then
  error "No ejecutes este script como root ni con sudo.
  Úsalo como usuario normal: ./setup.sh
  No escribe /etc/hosts automáticamente."
fi

# ── Banner ─────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat << 'EOF'
  _   _                      _   _      _
 | \ | | _____  ___   _ ___ | \ | | ___| |_
 |  \| |/ _ \ \/ / | | / __||  \| |/ _ \ __|
 | |\  |  __/>  <| |_| \__ \| |\  |  __/ |_
 |_| \_|\___/_/\_\\__,_|___/|_| \_|\___|\__|

     Local Kubernetes Setup  (k3d + Traefik)
EOF
echo -e "${NC}"
echo -e "  Cluster    : ${BOLD}$CLUSTER${NC}"
echo -e "  Workers    : ${BOLD}$WORKERS${NC}"
echo -e "  Domain     : ${BOLD}${DOMAIN:-<required>}${NC}"
echo -e "  Kubeconfig : ${BOLD}$KUBECONFIG_PATH${NC}"
echo -e "  Modo       : ${BOLD}$([[ \"$RECREATE_CLUSTER\" == true ]] && echo recreate || echo reuse)${NC}"
echo -e "  Ingress    : ${BOLD}Traefik (incluido en k3d — sin webhooks problemáticos)${NC}"
if [[ -n "${NGROK_SOURCE:-}" ]]; then
  echo -e "  Ngrok      : ${BOLD}automático desde ${NGROK_SOURCE}${NC}"
fi
echo ""

# ── 1. Prerequisitos ──────────────────────────────────────────────────────────
step "1/7 Verificando prerequisitos"

check_cmd docker  "https://docs.docker.com/get-docker/"
check_cmd k3d     "curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"
check_cmd kubectl "https://kubernetes.io/docs/tasks/tools/"

docker info &>/dev/null || error "Docker no está corriendo. Inícialo primero."
success "Docker corriendo"

[[ -d "$MANIFESTS_DIR" ]] || error "No se encontró: $MANIFESTS_DIR"
[[ -d "$FRONTEND_DIR"  ]] || error "No se encontró: $FRONTEND_DIR"

if [[ -z "$DOMAIN" ]]; then
  error "DOMAIN es obligatorio. Usa por ejemplo: DOMAIN=mi-dominio.local ./setup.sh"
fi

mkdir -p "$HOME/.kube"

# Auto-detectar rutas de frontend y backend si no se pasan como variables de entorno
FRONTEND_SRC=${FRONTEND_SRC:-"$SCRIPT_DIR/frontend"}
# Preferir el directorio completo `nexusnet/` si existe (contiene el frontend real)
if [[ -d "$SCRIPT_DIR/nexusnet" ]]; then
  FRONTEND_SRC="$SCRIPT_DIR/nexusnet"
fi

BACKEND_SRC=${BACKEND_SRC:-"$SCRIPT_DIR/nexusnet-backend"}

# Normalizar DOMAIN cuando viene con esquema completo.
FULL_DOMAIN="$DOMAIN"
if [[ "$DOMAIN" =~ ^https?:// ]]; then
  FULL_DOMAIN="${DOMAIN%/}"
  DOMAIN="${DOMAIN#http://}"
  DOMAIN="${DOMAIN#https://}"
  DOMAIN="${DOMAIN%/}"
fi
if [[ -z "$DOMAIN" ]]; then
  error "DOMAIN es obligatorio. Usa por ejemplo: DOMAIN=mi-dominio.local ./setup.sh"
fi
SITE_URL="$FULL_DOMAIN"
if [[ ! "$SITE_URL" =~ ^https?:// ]]; then
  SITE_URL="http://${DOMAIN}"
fi

PUBLIC_URL="${NGROK_URL:-${FRONTEND_URL:-${OAUTH_CALLBACK_BASE_URL:-$SITE_URL}}}"
FRONTEND_URL="${FRONTEND_URL:-$PUBLIC_URL}"
OAUTH_CALLBACK_BASE_URL="${OAUTH_CALLBACK_BASE_URL:-$PUBLIC_URL}"

if [[ -z "${GOOGLE_CLIENT_ID:-}" || -z "${GOOGLE_CLIENT_SECRET:-}" || -z "${GITHUB_CLIENT_ID:-}" || -z "${GITHUB_CLIENT_SECRET:-}" ]]; then
  warn "Faltan credenciales OAuth en el entorno; Google/GitHub no funcionarán hasta definir GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET."
fi

# Expandir ~ si el usuario lo usa
FRONTEND_SRC="${FRONTEND_SRC/#\~/$HOME}"
BACKEND_SRC="${BACKEND_SRC/#\~/$HOME}"

[[ -d "$FRONTEND_SRC" ]] || error "Frontend no encontrado: $FRONTEND_SRC"
[[ -d "$BACKEND_SRC"  ]] || error "Backend no encontrado: $BACKEND_SRC"

is_ngrok_domain() {
  [[ "$1" == *.ngrok.io ]] || [[ "$1" == *.ngrok-free.dev ]]
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|\\]/\\&/g'
}

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

start_ngrok_tunnel() {
  local tunnel_domain=$1

  if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
    warn "NGROK_AUTHTOKEN no está definido; no se inicia el túnel ngrok automáticamente"
    return 0
  fi

  if ! is_ngrok_domain "$tunnel_domain"; then
    warn "El dominio '$tunnel_domain' no parece ser de ngrok; se omite el túnel automático"
    return 0
  fi

  if [[ -n "$(docker ps -q -f name=^/nexusnet-ngrok$)" ]]; then
    info "Reiniciando contenedor ngrok existente"
    docker rm -f nexusnet-ngrok >/dev/null 2>&1 || true
  fi

  info "Iniciando túnel ngrok para http://127.0.0.1:80 con dominio $tunnel_domain"
  if docker run -d \
    --name nexusnet-ngrok \
    --network host \
    -e NGROK_AUTHTOKEN="$NGROK_AUTHTOKEN" \
    ngrok/ngrok http 80 --url="$tunnel_domain" >/dev/null; then
    success "ngrok iniciado: https://$tunnel_domain"
  else
    warn "No se pudo iniciar ngrok automáticamente. Puedes lanzarlo manualmente con:"
    warn "  docker run -d --name nexusnet-ngrok --network host -e NGROK_AUTHTOKEN=*** ngrok/ngrok http 80 --url=$tunnel_domain"
  fi
}

if [[ "$FRONTEND_DIR" != "$FRONTEND_SRC" ]]; then
  cp "$FRONTEND_DIR/nginx.conf" "$FRONTEND_SRC/nginx.conf"
  cp "$FRONTEND_DIR/Dockerfile" "$FRONTEND_SRC/Dockerfile"
  info "Dockerfile y nginx.conf copiados al frontend"
else
  info "Origen y destino del frontend coinciden; no se requiere copia"
fi

# ── 2. Cluster ────────────────────────────────────────────────────────────────
step "2/7 Creando cluster k3d: $CLUSTER"

if k3d cluster list 2>/dev/null | grep -q "^$CLUSTER "; then
  if [[ "$RECREATE_CLUSTER" == true ]]; then
    warn "El cluster '$CLUSTER' ya existe. Eliminándolo y recreándolo automáticamente."
    k3d cluster delete "$CLUSTER" || true
  else
    info "El cluster '$CLUSTER' ya existe. Se reutilizará sin borrarlo."
  fi
fi

if ! k3d cluster list 2>/dev/null | grep -q "^$CLUSTER "; then
  k3d cluster create "$CLUSTER" \
    --agents "$WORKERS" \
    -p "80:80@loadbalancer" \
    -p "443:443@loadbalancer" \
    --registry-create "${CLUSTER}-registry:0.0.0.0:5000" \
    --wait \
    --timeout 120s
  success "Cluster creado"
fi

# Guardar kubeconfig con permisos correctos desde el principio
k3d kubeconfig get "$CLUSTER" > "$KUBECONFIG_PATH"
chmod 600 "$KUBECONFIG_PATH"
export KUBECONFIG="$KUBECONFIG_PATH"

kubectl cluster-info --request-timeout=10s
success "kubeconfig: $KUBECONFIG_PATH"

# ── 3. Traefik + CRDs ─────────────────────────────────────────────────────────
step "3/7 Instalando Traefik Ingress Controller (requerido)"

info "Aplicando manifest de Traefik..."
kubectl apply -f "$MANIFESTS_DIR/03-traefik.yaml"

info "Esperando rollout de Traefik (hasta 600s, puede tardar en cluster reciente)..."
if kubectl rollout status deployment/traefik -n traefik --timeout=600s 2>/dev/null; then
  success "Traefik listo y disponible"
else
  error "Traefik no está listo tras 600s. Traefik es REQUERIDO. Revisa: kubectl -n traefik describe deployment traefik y kubectl logs -n traefik -l app=traefik"
fi

start_ngrok_tunnel "$DOMAIN"

# ── 4. Build imágenes ─────────────────────────────────────────────────────────
step "4/7 Construyendo imágenes Docker"

info "Backend..."
docker build \
  -t nexusnet-api:local \
  -f "$BACKEND_SRC/docker/Dockerfile.prod" \
  "$BACKEND_SRC"
success "nexusnet-api:local lista"

# El frontend habla con el backend por el mismo host vía Ingress, así que usa la URL pública base.
FRONTEND_BUILD_ARG="$PUBLIC_URL"
info "Frontend (VITE_API_URL=$FRONTEND_BUILD_ARG)..."
docker build \
  -t nexusnet-frontend:local \
  --build-arg VITE_API_URL="$FRONTEND_BUILD_ARG" \
  "$FRONTEND_SRC"
success "nexusnet-frontend:local lista"

# Detectar un cluster inutilizable por presión de disco antes de esperar minutos.
check_disk_pressure() {
  local pressured_nodes
  pressured_nodes=$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{range .status.conditions[?(@.type=="DiskPressure")]}{.status}{end}{"\n"}{end}' 2>/dev/null || true)

  if echo "$pressured_nodes" | awk -F'|' '$2 == "True" { print $1 }' | grep -q .; then
    local nodes
    nodes=$(echo "$pressured_nodes" | awk -F'|' '$2 == "True" { print $1 }' | paste -sd ', ' -)
    error "El cluster entró en DiskPressure en: ${nodes}.
Esto bloquea scheduling, PVCs y provoca evictions como las de Traefik, PostgreSQL y Redis.
Libera espacio en Docker/k3d y vuelve a ejecutar. Prueba primero:
  docker system df
  docker system prune -af
  docker volume prune -f
Si sigue igual, elimina el cluster y reintenta: k3d cluster delete $CLUSTER"
  fi
}

render_and_apply_secrets() {
  local frontend_url oauth_callback_base_url github_client_id github_client_secret google_client_id google_client_secret
  frontend_url="$FRONTEND_URL"
  oauth_callback_base_url="$OAUTH_CALLBACK_BASE_URL"
  github_client_id="${GITHUB_CLIENT_ID:-}"
  github_client_secret="${GITHUB_CLIENT_SECRET:-}"
  google_client_id="${GOOGLE_CLIENT_ID:-}"
  google_client_secret="${GOOGLE_CLIENT_SECRET:-}"

  sed \
    -e "s|__DOMAIN__|$(escape_sed_replacement "$DOMAIN")|g" \
    -e "s|__FRONTEND_URL__|$(escape_sed_replacement "$frontend_url")|g" \
    -e "s|__OAUTH_CALLBACK_BASE_URL__|$(escape_sed_replacement "$oauth_callback_base_url")|g" \
    -e "s|__GITHUB_CLIENT_ID__|$(escape_sed_replacement "$github_client_id")|g" \
    -e "s|__GITHUB_CLIENT_SECRET__|$(escape_sed_replacement "$github_client_secret")|g" \
    -e "s|__GOOGLE_CLIENT_ID__|$(escape_sed_replacement "$google_client_id")|g" \
    -e "s|__GOOGLE_CLIENT_SECRET__|$(escape_sed_replacement "$google_client_secret")|g" \
    "$MANIFESTS_DIR/04-secrets.yaml" | kubectl apply -f -
}

# ── 5. Importar imágenes ──────────────────────────────────────────────────────
step "5/7 Importando imágenes en k3d"

k3d image import nexusnet-api:local nexusnet-frontend:local -c "$CLUSTER"
success "Imágenes importadas"

check_disk_pressure

# ── 6. Manifiestos ────────────────────────────────────────────────────────────
step "6/7 Aplicando manifiestos Kubernetes"

# Aplicar manifiestos base (almacenamiento, BD, cache, API, frontend)
info "Aplicando base (Storage, PostgreSQL, Redis, Backend, Frontend)..."
for manifest in "$MANIFESTS_DIR"/0[1-3]*.yaml; do
  kubectl apply -f "$manifest"
done

info "Aplicando configuración con dominio: $DOMAIN"
render_and_apply_secrets

for manifest in "$MANIFESTS_DIR"/0[5-6]*.yaml; do
  kubectl apply -f "$manifest"
done

# Aplicar manifiestos finales (escalado, sin dashboard todavía)
info "Aplicando políticas de escalado y RBAC..."
for manifest in "$MANIFESTS_DIR"/08*.yaml; do
  kubectl apply -f "$manifest"
done

# Aplicar stack de Vault, Monitoreo y DR
info "Aplicando Vault Secrets Manager..."
substitute_domain "$MANIFESTS_DIR/10-vault-secrets.yaml" | kubectl apply -f - 2>&1 | grep -v "Warning:" || true

info "Aplicando stack de monitoreo (Prometheus, Grafana, Alertmanager)..."
substitute_domain "$MANIFESTS_DIR/11-monitoring-stack.yaml" | kubectl apply -f - 2>&1 | grep -v "Warning:" || true

# Reiniciar Grafana para forzar carga de provisioning (dashboards)
info "Reiniciando Grafana para cargar dashboards provisionales..."
kubectl rollout restart deployment/grafana -n monitoring || true

# Esperar a que Grafana esté listo y que los dashboards aparezcan
GRAFANA_POD=""
deadline=$(( $(date +%s) + 120 ))
while (( $(date +%s) < deadline )); do
  GRAFANA_POD=$(kubectl get pods -n monitoring -l app=grafana -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "$GRAFANA_POD" ]]; then
    kubectl wait -n monitoring --for=condition=ready pod/$GRAFANA_POD --timeout=60s >/dev/null 2>&1 || true
    if kubectl exec -n monitoring "$GRAFANA_POD" -- test -d /var/lib/grafana/dashboards >/dev/null 2>&1; then
      if kubectl exec -n monitoring "$GRAFANA_POD" -- ls -1 /var/lib/grafana/dashboards | grep -q .; then
        success "Grafana listo y dashboards provisionados en pod $GRAFANA_POD"
        break
      fi
    fi
  fi
  echo -n "."
  sleep 5
done
if [[ -z "$GRAFANA_POD" ]] || ! kubectl exec -n monitoring "$GRAFANA_POD" -- ls -1 /var/lib/grafana/dashboards >/dev/null 2>&1; then
  warn "No se detectaron dashboards montados en Grafana tras 2 minutos. Revisa: kubectl -n monitoring describe pod $GRAFANA_POD y kubectl logs -n monitoring deployment/grafana"
fi

info "Aplicando recuperación ante desastres..."
kubectl apply -f "$MANIFESTS_DIR/12-disaster-recovery.yaml" 2>&1 | grep -v "Warning:" || true

info "Aplicando hardening de seguridad..."
if [[ -f "$MANIFESTS_DIR/13-security-hardening.yaml" ]]; then
  substitute_domain "$MANIFESTS_DIR/13-security-hardening.yaml" | kubectl apply -f - 2>&1 | grep -v "Warning:" || true
fi

info "Aplicando servicio de auditoria de resiliencia..."
if [[ -f "$MANIFESTS_DIR/14-resilience-auditor.yaml" ]]; then
  kubectl apply -f "$MANIFESTS_DIR/14-resilience-auditor.yaml" 2>&1 | grep -v "Warning:" || true
fi

# ── Crear Ingress consolidados (uno por namespace) para evitar conflictos ────
create_consolidated_ingress() {
  local domain="$1"
  # Ingress en namespace default para API y Frontend
  cat << EOF | kubectl apply -f -
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
    - host: "$domain"
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
    - host: "$domain"
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
    - host: "$domain"
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
}

info "Creando Ingress consolidado para evitar conflictos de rutas..."
create_consolidated_ingress "$DOMAIN"
success "Ingress consolidado creado"

if [[ "$RECREATE_CLUSTER" == false ]]; then
  info "Reutilizando cluster: forzando rollout de backend y frontend para tomar las nuevas imágenes locales..."
  kubectl rollout restart deployment/nexusnet-api deployment/nexusnet-frontend
fi

# ── Helpers de espera ─────────────────────────────────────────────────────────

# Espera a que un StatefulSet tenga al menos N pods Ready
wait_statefulset_ready() {
  local name=$1 min_ready=${2:-1} timeout=${3:-300}
  local deadline=$(( $(date +%s) + timeout ))
  info "Esperando StatefulSet/$name (mínimo $min_ready pod(s) ready, timeout ${timeout}s)..."
  while true; do
    local ready
    ready=$(kubectl get statefulset "$name" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)
    ready=${ready:-0}
    if (( ready >= min_ready )); then
      echo ""
      success "StatefulSet/$name listo ($ready pods ready)"
      return 0
    fi
    local remaining=$(( deadline - $(date +%s) ))
    if (( remaining <= 0 )); then
      echo ""
      warn "Timeout esperando $name ($ready/$min_ready ready) — continuando de todas formas"
      return 0
    fi
    # mostrar estado detallado del pod
    local phase
    phase=$(kubectl get pod "${name}-0" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Pending")
    local init_status
    init_status=$(kubectl get pod "${name}-0" -o jsonpath='{range .status.initContainerStatuses[*]}{.name}:{.state.waiting.reason} {end}' 2>/dev/null || echo "")
    echo -ne "\r  ⏳ $name: $ready/$min_ready ready | pod: $phase $init_status| ${remaining}s restantes    "
    sleep 5
  done
}

# Espera a que Postgres acepte conexiones TCP reales (no solo pod Ready)
wait_postgres_accepting() {
  local timeout=${1:-300}
  local deadline=$(( $(date +%s) + timeout ))
  info "Verificando que postgres-0 acepte conexiones TCP..."
  while true; do
    if kubectl exec postgres-0 -- pg_isready -U postgres -q 2>/dev/null; then
      echo ""
      success "PostgreSQL aceptando conexiones"
      return 0
    fi
    local remaining=$(( deadline - $(date +%s) ))
    if (( remaining <= 0 )); then
      echo ""
      warn "pg_isready timeout — intentando migración de todas formas"
      return 0
    fi
    # mostrar logs recientes del pod para saber qué está haciendo
    local last_log
    last_log=$(kubectl logs postgres-0 --tail=1 2>/dev/null | tr -d '\n' | cut -c1-60 || echo "iniciando...")
    echo -ne "\r  ⏳ pg_isready | ${remaining}s restantes | $last_log    "
    sleep 5
  done
}


# Corre migración Prisma con reintentos
run_migrations() {
  local max_attempts=5 attempt=1
  info "Ejecutando migraciones Prisma (hasta $max_attempts intentos)..."
  while (( attempt <= max_attempts )); do
    echo "  → Intento $attempt/$max_attempts..."
    # limpiar pod anterior si quedó colgado
    kubectl delete pod prisma-migrate --ignore-not-found=true --wait=true 2>/dev/null || true
    # Preferir ejecutar migraciones desde un pod `nexusnet-api` ya creado (evita ImagePullBackOff)
    API_POD=$(kubectl get pods -n default -l app=nexusnet-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [[ -n "$API_POD" ]]; then
      info "Ejecutando migraciones dentro del pod $API_POD"
      if kubectl exec -n default "$API_POD" -- sh -c "cd /app && (npx prisma migrate deploy || npx prisma db push --accept-data-loss) && echo MIGRATION_OK" 2>&1 | tee /tmp/prisma-migrate.log | grep -q "MIGRATION_OK"; then
        success "Migraciones aplicadas correctamente (desde pod $API_POD)"
        return 0
      fi
    else
      # Si no hay pod disponible, intentar con un pod temporal (antigua estrategia)
      warn "No hay pod 'nexusnet-api' disponible, intentando crear pod temporal para migraciones"
      if kubectl run prisma-migrate \
        --image=nexusnet-api:local \
        --image-pull-policy=IfNotPresent \
        --labels="app=nexusnet-api" \
        --restart=Never --rm --attach \
          --env="DATABASE_URL=postgresql://postgres:postgres@postgres:5432/nexusnet?schema=public" \
          --command -- sh -c \"cd /app && (npx prisma migrate deploy || npx prisma db push --accept-data-loss) && echo MIGRATION_OK\" \
          2>&1 | tee /tmp/prisma-migrate.log | grep -q "MIGRATION_OK"; then
        success "Migraciones aplicadas correctamente (pod temporal)"
        return 0
      fi
    fi
    warn "Intento $attempt falló. Esperando 15s antes de reintentar..."
    sleep 15
    (( attempt++ ))
  done
  warn "Migraciones fallaron tras $max_attempts intentos. Revisa: cat /tmp/prisma-migrate.log"
  warn "Puedes correrlas manualmente después con:"
  warn "  kubectl run prisma-migrate --image=nexusnet-api:local --image-pull-policy=IfNotPresent --labels=\"app=nexusnet-api\" --restart=Never --rm --attach --env=\"DATABASE_URL=postgresql://postgres:postgres@postgres:5432/nexusnet?schema=public\" --command -- sh -c \"cd /app && npx prisma migrate deploy\""
}

# Espera a que un Deployment tenga sus réplicas disponibles (con timeout largo)
wait_deployment() {
  local name=$1 timeout=${2:-300}
  info "Esperando Deployment/$name (timeout ${timeout}s)..."
  if kubectl rollout status deployment/"$name" --timeout="${timeout}s"; then
    success "$name listo"
  else
    warn "$name tardó más de ${timeout}s — puede seguir iniciando en background"
    info "Monitorea con: kubectl get pods -l app=$name -w"
  fi
}

# ── Esperas principales ────────────────────────────────────────────────────────

# Postgres: esperar primary (postgres-0) + al menos 1 réplica
wait_statefulset_ready "postgres"      1 120
wait_postgres_accepting                  90

# Redis: esperar master solamente (sentinels y replicas pueden tardar más)
wait_statefulset_ready "redis-master"  1 90
# sentinel corre como sidecar en redis-master, no necesita espera separada

# Migraciones (ahora con Postgres realmente listo)
run_migrations

# Backend y Frontend
wait_deployment "nexusnet-api"      300
wait_deployment "nexusnet-frontend" 120

# ── 7. Dashboard ──────────────────────────────────────────────────────────────
step "7/7 Instalando Kubernetes Dashboard"

kubectl apply -f \
  https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

info "Esperando dashboard..."
kubectl wait \
  --namespace kubernetes-dashboard \
  --for=condition=ready pod \
  -l k8s-app=kubernetes-dashboard \
  --timeout=120s \
  && success "Dashboard listo" \
  || warn "Dashboard tardando — continúa de todas formas"

info "Aplicando RBAC del dashboard..."
kubectl apply -f "$MANIFESTS_DIR/09-dashboard-rbac.yaml"

DASHBOARD_TOKEN=$(
  kubectl get secret nexusnet-admin-token \
    -n kubernetes-dashboard \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 --decode \
  || kubectl create token nexusnet-admin -n kubernetes-dashboard 2>/dev/null \
  || echo "Ejecuta: kubectl create token nexusnet-admin -n kubernetes-dashboard"
)

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅  NexusNet desplegado exitosamente${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
NODE_IP=$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')

echo ""
echo -e "${BOLD}DNS local:${NC}"
echo -e "  Si usas desarrollo local, apunta tu dominio al IP del nodo o del load balancer."
echo -e "  Ejemplo /etc/hosts: ${CYAN}$NODE_IP $DOMAIN${NC}"
echo -e "  Ejemplo dnsmasq: ${CYAN}address=/$DOMAIN/$NODE_IP${NC}"
echo ""

echo -e "${BOLD}Aplicación (con Traefik Ingress):${NC}"
echo -e "  🌐 App      → ${CYAN}$SITE_URL${NC}"
echo -e "  🔌 API      → ${CYAN}$SITE_URL/api/v1${NC}"
echo -e "  📖 Swagger  → ${CYAN}$SITE_URL/docs${NC}"
echo -e "  ❤️  Health   → ${CYAN}$SITE_URL/health${NC}"
echo ""
echo -e "  📊 Grafana  → ${CYAN}$SITE_URL/grafana${NC}"
echo -e "  📈 Prometheus → ${CYAN}$SITE_URL/prometheus${NC}"
echo -e "  🔒 Vault     → ${CYAN}$SITE_URL/vault${NC}"
echo -e "  🧪 Resilience Report → ${CYAN}$SITE_URL/resilience/report${NC}"
echo ""

# Dar instrucciones claras para DNS local o URL pública
if [[ "$DOMAIN" == *.local ]] || [[ "$DOMAIN" == *.localhost ]]; then
  echo -e "${BOLD}${YELLOW}⚠️  Configurar DNS local para '$DOMAIN'${NC}"
  echo -e ""
  echo -e "  Opción A - /etc/hosts (manual, local):"
  echo -e "    ${CYAN}sudo sh -c 'echo \"$NODE_IP $DOMAIN\" >> /etc/hosts'${NC}"
  echo -e ""
  echo -e "  Opción B - dnsmasq (para toda la red local):"
  echo -e "    ${CYAN}echo \"address=/$DOMAIN/$NODE_IP\" | sudo tee -a /etc/dnsmasq.conf${NC}"
  echo -e "    ${CYAN}sudo systemctl restart dnsmasq${NC}"
  echo -e ""
  echo -e "  Opción C - CoreDNS local (en el cluster):"
  echo -e "    ${CYAN}kubectl get configmap -n kube-system coredns -o yaml | sed 's/in-addr.arpa/in-addr.arpa\\n    $DOMAIN:53 {\\n        rewrite type A $DOMAIN $NODE_IP/' | kubectl apply -f -${NC}"
  echo -e ""
elif [[ "$DOMAIN" == *".ngrok.io" ]] || [[ "$DOMAIN" == *".ngrok-free.dev" ]]; then
  echo -e "${BOLD}URL pública de ngrok:${NC}"
  echo -e "  ${CYAN}$SITE_URL${NC}"
  echo -e ""
else
  echo -e "${BOLD}DNS local:${NC}"
  echo -e "  Para acceder localmente, agregá a /etc/hosts:"
  echo -e "    ${CYAN}sudo sh -c 'echo \"$NODE_IP $DOMAIN\" >> /etc/hosts'${NC}"
  echo -e ""
fi

echo -e "${BOLD}OAuth / Google Login:${NC}"
echo -e "  El dominio '${BOLD}$DOMAIN${NC}' debe ser configurado en:"
echo -e "    1. Google Cloud Console → OAuth 2.0 authorized redirect URIs"
echo -e "    2. https://$DOMAIN/api/v1/auth/google/callback"
echo -e ""

echo -e "${BOLD}Kubernetes Dashboard:${NC}"
echo -e "  1. En otra terminal:"
echo -e "     ${CYAN}export KUBECONFIG=$KUBECONFIG_PATH && kubectl proxy${NC}"
echo ""
echo -e "  2. Abre en el navegador:"
echo -e "     ${CYAN}http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/${NC}"
echo ""
echo -e "  3. Pega este token:"
echo -e "     ${YELLOW}${DASHBOARD_TOKEN}${NC}"
echo ""
echo -e "${BOLD}Para usar kubectl en esta terminal:${NC}"
echo -e "  ${CYAN}export KUBECONFIG=$KUBECONFIG_PATH${NC}"
echo ""
echo -e "${BOLD}Comandos de gestión (carga en cualquier terminal):${NC}"
echo -e "  ${CYAN}source $SCRIPT_DIR/nexusnet-commands.sh${NC}"
echo -e "  ${CYAN}nn-help${NC}"
echo ""
echo -e "${BOLD}Para apagar todo:${NC}"
echo -e "  ${CYAN}k3d cluster delete $CLUSTER${NC}"
echo ""
echo -e "${BOLD}Simular problemas de red y fallos:${NC}"
echo -e "  1) Bloquear tráfico a un servicio (ej: grafana):"
echo -e "     ${CYAN}./tools/simulate_network_issues.sh block grafana${NC}"
echo -e "  2) Restaurar tráfico al servicio (ej: grafana):"
echo -e "     ${CYAN}./tools/simulate_network_issues.sh restore grafana${NC}"
echo -e "  3) Simular caída de pods (ej: reiniciar backend):"
echo -e "     ${CYAN}kubectl delete pod -l app=nexusnet-api${NC}"
echo -e "  4) Ver logs y estado: ${CYAN}kubectl get pods -A && kubectl logs -n monitoring deployment/grafana --tail=50${NC}"
echo -e "  5) Auditoria de resiliencia (JSON): ${CYAN}curl -s $SITE_URL/resilience/report | jq${NC}"
echo ""