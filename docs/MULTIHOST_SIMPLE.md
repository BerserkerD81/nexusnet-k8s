GUÍA SIMPLIFICADA — NexusNet Multi-Host (paso a paso)

═══════════════════════════════════════════════════════════════════════════════
PREPARACIÓN INICIAL (en tu PC principal)
═══════════════════════════════════════════════════════════════════════════════

PASO 0: Limpiar k3s anterior (si hay problemas)
```bash
sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
sudo systemctl daemon-reload
sleep 5
```

PASO 1: Aumentar límites de archivos abiertos
```bash
sudo bash -c 'echo "* soft nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "* hard nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "root soft nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "root hard nofile 65535" >> /etc/security/limits.conf'
```

PASO 2: Reinicia tu sesión o equipo (para aplicar límites)
```bash
exit
# Vuelve a entrar o reinicia
```

═══════════════════════════════════════════════════════════════════════════════
EN EL SERVIDOR PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════

PASO 3: Ve al directorio del proyecto
```bash
cd ~/projects/nexusnet-k8s
chmod +x setup-k3s-multihost.sh
```

PASO 4: Ejecuta el setup como SERVER
Reemplaza:
  - nexusnet.test → tu dominio (ej. miapp.local)
  - 192.168.1.240-192.168.1.250 → rango IP libre en tu red

```bash
DOMAIN=nexusnet.test METALLB_RANGE="192.168.1.240-192.168.1.250" \
./setup-k3s-multihost.sh server
```

Esto tardará 10-15 minutos. Espera a que termine.

PASO 5: Cuando termina, verás algo como:
```
✅  NexusNet k3s SERVER listo

Servidor:
  IP local (aprox): 192.168.1.10
  Domain: nexusnet.test

Para unir nodos WORKERS a este cluster:
  En cada worker ejecuta:
    ./setup-k3s-multihost.sh agent 192.168.1.10 K10a...TOKEN...
```

**APUNTA ESTOS DATOS:**
- IP_SERVER = 192.168.1.10 (tu IP local)
- TOKEN = K10a...TOKEN... (cadena larga de caracteres)

═══════════════════════════════════════════════════════════════════════════════
EN CADA MÁQUINA TRABAJADORA (WORKER)
═══════════════════════════════════════════════════════════════════════════════

Repite los PASOS 0-2 en cada máquina trabajadora.

PASO 6: En cada worker, clona o copia el proyecto
```bash
# Opción A: clonar desde GitHub/tu repo
git clone <URL_DEL_REPO> ~/projects/nexusnet-k8s
cd ~/projects/nexusnet-k8s

# Opción B: copiar desde el servidor (si tienes SSH)
scp -r usuario@192.168.1.10:~/projects/nexusnet-k8s ~/projects/
cd ~/projects/nexusnet-k8s
```

PASO 7: Ejecuta el setup como AGENT
Reemplaza:
  - IP_SERVER = la IP que anotaste (ej 192.168.1.10)
  - TOKEN = el token que anotaste

```bash
chmod +x setup-k3s-multihost.sh
./setup-k3s-multihost.sh agent 192.168.1.10 "K10a0123...token_completo..."
```

Esto tardará 1-2 minutos. Verás:
```
✅  Nodo AGENT unido al cluster

En el SERVER, verifica con:
  kubectl get nodes
```

═══════════════════════════════════════════════════════════════════════════════
VERIFICAR QUE TODO FUNCIONÓ (en el SERVER)
═══════════════════════════════════════════════════════════════════════════════

PASO 8: En el servidor, configura kubeconfig
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

Deberías ver algo así:
```
NAME              STATUS   ROLES
server            Ready    control-plane
worker-1          Ready    <none>
worker-2          Ready    <none>
```

PASO 9: Verifica que los pods están corriendo
```bash
kubectl get pods -A
```

═══════════════════════════════════════════════════════════════════════════════
CONFIGURAR DNS EN CADA MÁQUINA (cliente, server y workers)
═══════════════════════════════════════════════════════════════════════════════

PASO 10: En cada máquina (incluyendo workers), agrega a /etc/hosts
Reemplaza IP_SERVER por tu IP real (ej 192.168.1.10) y DOMAIN por tu dominio (ej nexusnet.test)

Linux/macOS:
```bash
echo "192.168.1.10 nexusnet.test" | sudo tee -a /etc/hosts
```

Windows (PowerShell como admin):
```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "192.168.1.10 nexusnet.test"
```

═══════════════════════════════════════════════════════════════════════════════
PROBAR LA APP
═══════════════════════════════════════════════════════════════════════════════

PASO 11: En cualquier máquina de tu red, abre en navegador:
```
http://nexusnet.test
```

¡Listo! La app está accesible desde todas las máquinas de tu red.

═══════════════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
═══════════════════════════════════════════════════════════════════════════════

❌ Server no arranca (too many open files)
→ Hiciste PASO 2 correctamente? Cierra sesión y vuelve a entrar.

❌ Agent no se conecta
→ Verifica: ping 192.168.1.10 desde el worker
→ Verifica que el TOKEN es correcto
→ Verifica firewall: puerto 6443 abierto

❌ kubectl no encuentra el kubeconfig
→ export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
→ Luego: kubectl get nodes

❌ Pods no inician (ImagePullBackOff)
→ Las imágenes (nexusnet-api:local) solo existen en el server
→ Esto es normal en desarrollo. Se cachean en los workers cuando se usan.

═══════════════════════════════════════════════════════════════════════════════
RESUMEN DE COMANDOS (para copiar/pegar rápido)
═══════════════════════════════════════════════════════════════════════════════

SERVER PRINCIPAL:
```bash
sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
sudo bash -c 'echo "* soft nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "* hard nofile 65535" >> /etc/security/limits.conf'
# logout y vuelve a entrar
cd ~/projects/nexusnet-k8s
chmod +x setup-k3s-multihost.sh
DOMAIN=nexusnet.test METALLB_RANGE="192.168.1.240-192.168.1.250" ./setup-k3s-multihost.sh server
# espera a terminar y apunta IP + TOKEN
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

CADA WORKER:
```bash
sudo /usr/local/bin/k3s-uninstall.sh 2>/dev/null || true
sudo bash -c 'echo "* soft nofile 65535" >> /etc/security/limits.conf'
sudo bash -c 'echo "* hard nofile 65535" >> /etc/security/limits.conf'
# logout y vuelve a entrar
cd ~/projects/nexusnet-k8s
chmod +x setup-k3s-multihost.sh
./setup-k3s-multihost.sh agent 192.168.1.10 "K10a0123...TOKEN..."
```

TODAS LAS MÁQUINAS (DNS):
```bash
echo "192.168.1.10 nexusnet.test" | sudo tee -a /etc/hosts
```
