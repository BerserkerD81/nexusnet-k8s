#!/usr/bin/env bash
# =============================================================================
# NexusNet — k3s NODE (worker/agent)
# =============================================================================
#
# Uso:
#   ./setup-node.sh SERVER_IP TOKEN [DOMAIN]
#
#   O con variables de entorno:
#   SERVER_IP=192.168.1.10 TOKEN=K10a... DOMAIN=nexusnet.test ./setup-node.sh
#
# Alternativa: carga el .cluster-info generado por el server:
#   source .cluster-info && ./setup-node.sh "$SERVER_IP" "$TOKEN" "$DOMAIN"
#
# Variables opcionales:
#   REGISTRY_HOST   Registry desde donde bajar imágenes (ej. "192.168.1.10:5000")
#                   Necesario si el server usó REGISTRY_HOST al buildear.
#   NODE_LABELS     Labels adicionales (ej. "role=gpu,zone=local")
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

# ── Parámetros ────────────────────────────────────────────────────────────────
SERVER_IP=${1:-${SERVER_IP:-}}
TOKEN=${2:-${TOKEN:-}}
DOMAIN=${3:-${DOMAIN:-}}
REGISTRY_HOST=${REGISTRY_HOST:-}
NODE_LABELS=${NODE_LABELS:-}

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat << 'EOF'
  _   _                      _   _      _
 | \ | | _____  ___   _ ___ | \ | | ___| |_
 |  \| |/ _ \ \/ / | | / __||  \| |/ _ \ __|
 | |\  |  __/>  <| |_| \__ \| |\  |  __/ |_
 |_| \_|\___/_/\_\\__,_|___/|_| \_|\___|\___|

     k3s NODE — Uniéndose al cluster
EOF
echo -e "${NC}"
echo -e "  Server IP  : ${BOLD}${SERVER_IP:-<requerido>}${NC}"
echo -e "  Dominio    : ${BOLD}${DOMAIN:-<no configurado>}${NC}"
echo -e "  Registry   : ${BOLD}${REGISTRY_HOST:-<no configurado>}${NC}"
echo -e "  Labels     : ${BOLD}${NODE_LABELS:-ninguno}${NC}"
echo -e "  Este nodo  : ${BOLD}$(hostname)  /  $(hostname -I | awk '{print $1}')${NC}"
echo ""

# ── Validaciones ──────────────────────────────────────────────────────────────
step "1/4 Verificando prerequisitos"

[[ -z "$SERVER_IP" ]] && error "SERVER_IP requerido. Uso: ./setup-node.sh SERVER_IP TOKEN [DOMAIN]"
[[ -z "$TOKEN"     ]] && error "TOKEN requerido. Obtén el token del servidor en: /var/lib/rancher/k3s/server/node-token"

command -v curl &>/dev/null || error "curl no instalado. Instálalo primero."

# Verificar conectividad al server
info "Verificando conectividad con el server ($SERVER_IP:6443)..."
if curl -sk --connect-timeout 5 "https://$SERVER_IP:6443/ping" >/dev/null 2>&1 || \
   (command -v nc &>/dev/null && nc -z -w 5 "$SERVER_IP" 6443 2>/dev/null); then
  success "Server accesible en $SERVER_IP:6443"
else
  warn "No se pudo verificar conectividad a $SERVER_IP:6443"
  warn "Asegúrate de que:"
  warn "  - El servidor esté corriendo k3s"
  warn "  - El puerto 6443 esté abierto en el firewall del server"
  warn "  - Haya ruta de red entre este nodo y $SERVER_IP"
  echo ""
  read -r -p "¿Continuar de todas formas? [s/N] " reply
  [[ "$reply" =~ ^[sS]$ ]] || exit 1
fi

# ── Limpiar instalación previa (si aplica) ───────────────────────────────────
step "2/4 Preparando nodo"

if command -v k3s &>/dev/null; then
  info "k3s ya está instalado en este nodo."
  if systemctl is-active --quiet k3s-agent 2>/dev/null; then
    info "k3s-agent ya está corriendo."
    echo ""
    read -r -p "¿Desinstalar y reinstalar el agente? [s/N] " reply
    if [[ "$reply" =~ ^[sS]$ ]]; then
      info "Desinstalando k3s-agent existente..."
      if [[ -f /usr/local/bin/k3s-agent-uninstall.sh ]]; then
        sudo /usr/local/bin/k3s-agent-uninstall.sh
      elif [[ -f /usr/local/bin/k3s-uninstall.sh ]]; then
        sudo /usr/local/bin/k3s-uninstall.sh
      fi
      success "k3s desinstalado"
    else
      info "Manteniendo instalación existente."
    fi
  fi
fi

# Configurar registry inseguro si se usa uno local sin TLS
if [[ -n "$REGISTRY_HOST" ]]; then
  info "Configurando registry inseguro: $REGISTRY_HOST"
  sudo mkdir -p /etc/rancher/k3s
  cat <<EOF | sudo tee /etc/rancher/k3s/registries.yaml >/dev/null
mirrors:
  "$REGISTRY_HOST":
    endpoint:
      - "http://$REGISTRY_HOST"
EOF
  success "Registry configurado: $REGISTRY_HOST"
fi

# ── Instalar k3s agent ────────────────────────────────────────────────────────
step "3/4 Instalando k3s agent y uniéndose al cluster"

info "Conectando a https://$SERVER_IP:6443 ..."

INSTALL_EXEC_ARGS="agent"
if [[ -n "$NODE_LABELS" ]]; then
  # Convertir "role=gpu,zone=local" → "--node-label role=gpu --node-label zone=local"
  while IFS=',' read -ra LABELS; do
    for label in "${LABELS[@]}"; do
      INSTALL_EXEC_ARGS="$INSTALL_EXEC_ARGS --node-label $label"
    done
  done <<< "$NODE_LABELS"
fi

curl -sfL https://get.k3s.io | \
  K3S_URL="https://$SERVER_IP:6443" \
  K3S_TOKEN="$TOKEN" \
  sh -s - $INSTALL_EXEC_ARGS

# Esperar a que el agente esté activo
info "Esperando que k3s-agent esté activo..."
for i in {1..60}; do
  if systemctl is-active --quiet k3s-agent 2>/dev/null; then
    success "k3s-agent activo"
    break
  fi
  [[ $i -eq 60 ]] && warn "k3s-agent tardando en iniciar. Revisa: sudo journalctl -u k3s-agent -n 30"
  echo -n "."
  sleep 2
done
echo ""

# ── Pull de imágenes si hay registry ─────────────────────────────────────────
step "4/4 Descargando imágenes de la aplicación"

if [[ -n "$REGISTRY_HOST" ]]; then
  info "Descargando imágenes desde $REGISTRY_HOST..."
  for img in nexusnet-api:latest nexusnet-frontend:latest; do
    info "  Pulling $REGISTRY_HOST/$img ..."
    sudo k3s ctr images pull "http://$REGISTRY_HOST/$img" 2>/dev/null \
      || docker pull "$REGISTRY_HOST/$img" 2>/dev/null \
      || warn "No se pudo bajar $img — el nodo lo intentará cuando se schedule un pod"
  done
  success "Imágenes descargadas"
else
  warn "REGISTRY_HOST no definido."
  warn "Las imágenes 'nexusnet-api:local' y 'nexusnet-frontend:local' son locales al servidor."
  warn "Opciones para que este nodo pueda correr pods:"
  warn ""
  warn "  A) Configurar un registry accesible en la red:"
  warn "     En el server: REGISTRY_HOST=<IP>:5000 ./setup-server.sh"
  warn "     En este nodo: REGISTRY_HOST=<IP>:5000 ./setup-node.sh ..."
  warn ""
  warn "  B) Buildear las imágenes en este nodo también:"
  warn "     cd nexusnet-k8s"
  warn "     docker build -t nexusnet-api:local -f nexusnet-backend/docker/Dockerfile.prod nexusnet-backend"
  warn "     docker save nexusnet-api:local | sudo k3s ctr images import -"
  warn "     docker build -t nexusnet-frontend:local nexusnet"
  warn "     docker save nexusnet-frontend:local | sudo k3s ctr images import -"
  warn ""
  warn "  C) Usar imagePullPolicy=IfNotPresent (los pods ya en el server seguirán funcionando)"
fi

# ── Configurar kubectl local (opcional) ──────────────────────────────────────
if [[ -n "$SERVER_IP" ]]; then
  KUBE_DIR="$HOME/.kube"
  mkdir -p "$KUBE_DIR"
  KUBECONFIG_LOCAL="$KUBE_DIR/nexusnet-k3s.yaml"

  info "Para usar kubectl desde este nodo, copia el kubeconfig del server:"
  echo ""
  echo -e "  ${CYAN}scp $(whoami)@$SERVER_IP:/etc/rancher/k3s/k3s.yaml $KUBECONFIG_LOCAL${NC}"
  echo -e "  ${CYAN}sed -i 's/127.0.0.1/$SERVER_IP/g' $KUBECONFIG_LOCAL${NC}"
  echo -e "  ${CYAN}export KUBECONFIG=$KUBECONFIG_LOCAL${NC}"
  echo ""
fi

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  ✅  Nodo k3s unido al cluster exitosamente${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Este nodo:${NC}"
echo -e "  Hostname  : $(hostname)"
echo -e "  IP local  : $(hostname -I | awk '{print $1}')"
echo -e "  Servidor  : $SERVER_IP"
echo ""
echo -e "${BOLD}Para verificar desde el SERVER:${NC}"
echo -e "  ${CYAN}sudo kubectl --kubeconfig=/etc/rancher/k3s/k3s.yaml get nodes${NC}"
echo ""
echo -e "${BOLD}Estado del servicio en este nodo:${NC}"
echo -e "  ${CYAN}sudo systemctl status k3s-agent${NC}"
echo -e "  ${CYAN}sudo journalctl -u k3s-agent -f${NC}"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo -e "${BOLD}Agrega a /etc/hosts de este nodo para acceder a la app:${NC}"
  echo -e "  ${CYAN}sudo sh -c 'echo \"$SERVER_IP $DOMAIN\" >> /etc/hosts'${NC}"
  echo ""
fi
echo -e "${BOLD}Troubleshooting:${NC}"
echo -e "  ❌ No aparece en 'kubectl get nodes':"
echo -e "     - Verifica conectividad: ${CYAN}ping $SERVER_IP${NC}"
echo -e "     - Revisa logs del agent: ${CYAN}sudo journalctl -u k3s-agent -n 50${NC}"
echo -e "     - Confirma que el puerto 6443 está abierto en el server"
echo ""
echo -e "  ❌ ImagePullBackOff en pods:"
echo -e "     - Las imágenes locales no existen en este nodo"
echo -e "     - Usa REGISTRY_HOST o buildea las imágenes aquí"
echo ""
