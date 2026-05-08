#!/usr/bin/env bash
# =============================================================================
# NexusNet — Comandos rápidos de gestión
# =============================================================================
# Uso: source nexusnet-commands.sh       (carga los aliases en tu shell)
#      bash nexusnet-commands.sh help    (muestra ayuda)
# =============================================================================

CLUSTER=${NEXUSNET_CLUSTER:-nexusnet}
DOMAIN=${NEXUSNET_DOMAIN:-nexusnet.local}
# Buscar kubeconfig en ~/.kube primero (nuevo), luego /tmp (legacy)
if [[ -f "$HOME/.kube/k3d-${CLUSTER}.yaml" ]]; then
  export KUBECONFIG="$HOME/.kube/k3d-${CLUSTER}.yaml"
elif [[ -f "/tmp/k3d-${CLUSTER}.yaml" ]]; then
  chmod 600 "/tmp/k3d-${CLUSTER}.yaml" 2>/dev/null || true
  export KUBECONFIG="/tmp/k3d-${CLUSTER}.yaml"
fi

# ── Colores ────────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Funciones ──────────────────────────────────────────────────────────────────

nn-status() {
  echo -e "${BOLD}Pods:${NC}"
  kubectl get pods -o wide
  echo -e "\n${BOLD}Services:${NC}"
  kubectl get svc
  echo -e "\n${BOLD}Ingress:${NC}"
  kubectl get ing
  echo -e "\n${BOLD}HPA:${NC}"
  kubectl get hpa
  echo -e "\n${BOLD}PVC:${NC}"
  kubectl get pvc
}

nn-logs() {
  local svc=${1:-nexusnet-api}
  kubectl logs -f deployment/"$svc" --all-containers=true
}

nn-scale() {
  local replicas=${1:-3}
  echo "Escalando nexusnet-api a $replicas réplicas..."
  kubectl scale deployment/nexusnet-api --replicas="$replicas"
  kubectl rollout status deployment/nexusnet-api
}

nn-restart() {
  local svc=${1:-nexusnet-api}
  echo "Reiniciando $svc..."
  kubectl rollout restart deployment/"$svc"
  kubectl rollout status deployment/"$svc"
}

nn-rebuild-backend() {
  local src=${1:?"Uso: nn-rebuild-backend <ruta-al-backend>"}
  echo "Reconstruyendo imagen del backend..."
  docker build -t nexusnet-api:local -f "$src/docker/Dockerfile.prod" "$src"
  k3d image import nexusnet-api:local -c "$CLUSTER"
  kubectl rollout restart deployment/nexusnet-api
  kubectl rollout status deployment/nexusnet-api
  echo "✅ Backend actualizado"
}

nn-rebuild-frontend() {
  local src=${1:?"Uso: nn-rebuild-frontend <ruta-al-frontend>"}
  echo "Reconstruyendo imagen del frontend..."
  docker build -t nexusnet-frontend:local \
    --build-arg VITE_API_URL="http://${DOMAIN}" \
    "$src"
  k3d image import nexusnet-frontend:local -c "$CLUSTER"
  kubectl rollout restart deployment/nexusnet-frontend
  kubectl rollout status deployment/nexusnet-frontend
  echo "✅ Frontend actualizado"
}

nn-dashboard() {
  echo -e "${BOLD}Iniciando proxy para el dashboard...${NC}"
  echo ""
  echo -e "Token de acceso:"
  kubectl get secret nexusnet-admin-token \
    -n kubernetes-dashboard \
    -o jsonpath='{.data.token}' | base64 --decode
  echo ""
  echo ""
  echo -e "URL: ${CYAN}http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/${NC}"
  echo ""
  kubectl proxy
}

nn-token() {
  kubectl get secret nexusnet-admin-token \
    -n kubernetes-dashboard \
    -o jsonpath='{.data.token}' | base64 --decode
  echo ""
}

nn-stress() {
  local replicas=${1:-100}
  echo "Generando carga para probar HPA (${replicas} requests/seg)..."
  kubectl run stress-test \
    --image=busybox \
    --restart=Never \
    --rm -it \
    -- sh -c "while true; do wget -q -O- http://nexusnet-api:3000/health > /dev/null; done"
}

nn-delete-pod() {
  local pod=${1:?"Uso: nn-delete-pod <nombre-del-pod>"}
  echo "Eliminando pod $pod (se recreará automáticamente)..."
  kubectl delete pod "$pod"
  watch kubectl get pods
}

nn-db-shell() {
  echo "Conectando a PostgreSQL..."
  kubectl exec -it deployment/postgres -- psql -U postgres -d nexusnet
}

nn-redis-cli() {
  echo "Conectando a Redis..."
  kubectl exec -it deployment/redis -- redis-cli
}

nn-top() {
  kubectl top pods
}

nn-events() {
  kubectl get events --sort-by='.lastTimestamp' | tail -20
}

nn-cleanup() {
  echo "¿Eliminar el cluster $CLUSTER? Esto borra todo. (s/N)"
  read -r answer
  if [[ "$answer" =~ ^[Ss]$ ]]; then
    k3d cluster delete "$CLUSTER"
    echo "✅ Cluster eliminado"
  fi
}

nn-help() {
  cat << EOF

${BOLD}NexusNet — Comandos disponibles:${NC}

  ${CYAN}nn-status${NC}                          Estado general del cluster
  ${CYAN}nn-logs [deployment]${NC}               Logs en tiempo real (default: nexusnet-api)
  ${CYAN}nn-scale <replicas>${NC}                Escalar el backend (ej: nn-scale 5)
  ${CYAN}nn-restart [deployment]${NC}            Reiniciar un deployment
  ${CYAN}nn-rebuild-backend <ruta>${NC}          Reconstruir e importar imagen del backend
  ${CYAN}nn-rebuild-frontend <ruta>${NC}         Reconstruir e importar imagen del frontend
  ${CYAN}nn-dashboard${NC}                       Abrir el proxy del Kubernetes Dashboard
  ${CYAN}nn-token${NC}                           Mostrar token del dashboard
  ${CYAN}nn-stress${NC}                          Generar carga para probar HPA
  ${CYAN}nn-delete-pod <nombre>${NC}             Eliminar un pod (prueba de recuperación)
  ${CYAN}nn-db-shell${NC}                        Shell de PostgreSQL
  ${CYAN}nn-redis-cli${NC}                       Shell de Redis
  ${CYAN}nn-top${NC}                             CPU/memoria de los pods
  ${CYAN}nn-events${NC}                          Últimos eventos del cluster
  ${CYAN}nn-cleanup${NC}                         Eliminar el cluster completo

${BOLD}kubeconfig activo:${NC} $KUBECONFIG
${BOLD}Dominio activo:${NC} $DOMAIN

EOF
}

# Si se llama directamente (no con source), mostrar ayuda
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  case "${1:-help}" in
    help|--help|-h) nn-help ;;
    status)   nn-status ;;
    logs)     nn-logs "${2:-}" ;;
    scale)    nn-scale "${2:-3}" ;;
    restart)  nn-restart "${2:-nexusnet-api}" ;;
    dash)     nn-dashboard ;;
    token)    nn-token ;;
    cleanup)  nn-cleanup ;;
    *)        nn-help ;;
  esac
else
  echo -e "✅ Comandos ${CYAN}nn-*${NC} cargados. Ejecuta ${CYAN}nn-help${NC} para ver todos."
fi
