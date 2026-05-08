Guía paso a paso — k3s multi-host (servidor + nodos)

═══════════════════════════════════════════════════════════════════════════════
PARTE 1: CONFIGURAR SERVIDOR PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════

Paso 1: En tu PC principal, abre una terminal y ve al directorio del proyecto
```bash
cd ~/projects/nexusnet-k8s
```

Paso 2: Hazle ejecutable el script
```bash
chmod +x setup-k3s-multihost.sh
```

Paso 3: Ejecutar el setup como SERVER
Reemplaza nexusnet.test por el dominio que quieras (ej. miapp.local)
Reemplaza 192.168.1.240-192.168.1.250 por un rango de IPs libre en tu red (ej. 192.168.1.200-192.168.1.210)

```bash
DOMAIN=nexusnet.test METALLB_RANGE="192.168.1.240-192.168.1.250" ./setup-k3s-multihost.sh server
```

Nota: sin METALLB_RANGE, no se instala MetalLB (pero Traefik seguirá funcionando).

Esto tardará unos 10-15 minutos. El script:
✓ Instala k3s server
✓ Instala MetalLB (si lo especificaste)
✓ Construye imágenes Docker locales (backend y frontend)
✓ Aplica los manifests de Kubernetes (DB, Redis, Backend, Frontend, etc.)

Paso 4: Al terminar, verás un resumen con:
- Tu IP local (SERVER_IP): ej 192.168.1.10
- Un TOKEN para que otros equipos se unan

Apunta esos dos valores — los necesitas para los workers.

═══════════════════════════════════════════════════════════════════════════════
PARTE 2: UNIR NODOS TRABAJADORES AL CLUSTER
═══════════════════════════════════════════════════════════════════════════════

Paso 5: En cada equipo que quieras unir como WORKER:
- Copia la carpeta nexusnet-k8s a ese equipo (ó clona el repo)
- Abre terminal en esa carpeta

```bash
cd ~/projects/nexusnet-k8s
chmod +x setup-k3s-multihost.sh
```

Paso 6: Ejecuta el setup como AGENT
Reemplaza:
  SERVER_IP = la IP local del equipo principal (ej 192.168.1.10)
  TOKEN = el token que te mostró el server (ej K10a...token...)

```bash
./setup-k3s-multihost.sh agent 192.168.1.10 K10a...token...
```

Ejemplo completo:
```bash
./setup-k3s-multihost.sh agent 192.168.1.10 "K10a0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ=="
```

Esto tardará 1-2 minutos. El script:
✓ Instala k3s agent
✓ Se conecta al servidor en 192.168.1.10:6443
✓ Se registra en el cluster

═══════════════════════════════════════════════════════════════════════════════
PARTE 3: VERIFICAR QUE TODO FUNCIONÓ
═══════════════════════════════════════════════════════════════════════════════

Paso 7: En el SERVIDOR, verifica que todos los nodos están conectados

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

Deberías ver algo como:
```
NAME           STATUS   ROLES
node-principal Ready    control-plane
node-worker-1  Ready    <none>
node-worker-2  Ready    <none>
```

Paso 8: Verifica que los pods están corriendo

```bash
kubectl get pods -A
```

Deberías ver pods en namespaces: default, monitoring, vault, etc.

═══════════════════════════════════════════════════════════════════════════════
PARTE 4: CONFIGURAR DNS LOCAL (en cada equipo cliente)
═══════════════════════════════════════════════════════════════════════════════

Paso 9: En cada equipo (incluyendo el servidor si quieres acceder desde navegador):
Agrega una línea a /etc/hosts apuntando el dominio a la IP del servidor

Linux / macOS (en terminal):
```bash
echo "192.168.1.10 nexusnet.test" | sudo tee -a /etc/hosts
```

Windows (con PowerShell como admin):
```powershell
Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "192.168.1.10 nexusnet.test"
```

Paso 10: Prueba acceso a la app
En un navegador en cualquier equipo de la red:
- Abre: http://nexusnet.test
- Deberías ver la app NexusNet

═══════════════════════════════════════════════════════════════════════════════
NOTAS IMPORTANTES
═══════════════════════════════════════════════════════════════════════════════

🔹 FIREWALL:
- Si tienes firewall, abre puertos entre los equipos:
  - 6443 (Kubernetes API) entre server y workers
  - 80 y 443 si quieres acceder desde otros equipos

🔹 IMÁGENES DOCKER:
- Las imágenes (nexusnet-api:local, nexusnet-frontend:local) se construyen SOLO en el server
- k3s automáticamente las distribuye/cachea en los nodos
- Si una imagen no existe en un nodo, k3s intenta pull (falla si es local)
- Para evitar esto: usa REGISTRY_HOST para pushear a un registry accesible

🔹 KUBECONFIG EN OTROS EQUIPOS:
Si quieres ejecutar kubectl desde otro equipo:
```bash
scp usuario@192.168.1.10:/etc/rancher/k3s/k3s.yaml ~/.kube/config
export KUBECONFIG=~/.kube/config
kubectl get nodes
```

🔹 OAUTH / GOOGLE LOGIN:
Asegúrate de configurar el dominio en Google Cloud Console:
  OAuth 2.0 authorized redirect URIs → http://nexusnet.test/api/v1/auth/google/callback

═══════════════════════════════════════════════════════════════════════════════
COMANDOS ÚTILES PARA EL DÍA A DÍA
═══════════════════════════════════════════════════════════════════════════════

# Ver estado del cluster
kubectl get nodes
kubectl get pods -A
kubectl get svc -A

# Logs de la app
kubectl logs -f deployment/nexusnet-api
kubectl logs -f deployment/nexusnet-frontend

# Entrar en un pod
kubectl exec -it deployment/nexusnet-api -- /bin/bash

# Ver eventos (útil para debugging)
kubectl get events -A --sort-by='.lastTimestamp'

# Eliminar un pod (k3s lo reinicia automáticamente)
kubectl delete pod -l app=nexusnet-api

# Reiniciar un deployment
kubectl rollout restart deployment/nexusnet-api

# Ver recursos (CPU, memoria)
kubectl top nodes
kubectl top pods -A

═══════════════════════════════════════════════════════════════════════════════
TROUBLESHOOTING
═══════════════════════════════════════════════════════════════════════════════

❌ Agent no se conecta:
- Verifica que la IP del server es correcta
- Verifica que el token es correcto
- Verifica conectividad: ping SERVER_IP desde el worker
- Revisa firewalls, puertos 6443 debe estar abierto

❌ Pods no inician:
- kubectl describe pod POD_NAME
- kubectl logs POD_NAME
- Revisa: kubectl get events -A

❌ ImagePullBackOff en pods:
- Las imágenes locales (nexusnet-api:local) no existen en ese nodo
- Solución: pushea a un registry central o construye en ese nodo

❌ MetalLB no asigna IP:
- Verifica que el rango de IPs está disponible
- kubectl get svc -A | grep LoadBalancer
- Revisa: kubectl logs -n metallb-system

═══════════════════════════════════════════════════════════════════════════════
¡LISTO! 🎉

Tu cluster k3s multi-host está funcionando. Todas las máquinas de tu red local
pueden acceder a la app en http://nexusnet.test
