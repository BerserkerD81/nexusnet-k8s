Opción A — Exponer el cluster desde tu equipo principal

Resumen:
- Ejecutas el cluster en tu equipo principal (server) usando `setup.sh` o `k3s`.
- Los otros equipos usan kubectl con un kubeconfig limitado (no admin) y apuntan el dominio al IP del server.

Pasos principales:
1) En el server: crear un kubeconfig limitado para clientes

```bash
chmod +x scripts/create-sa-kubeconfig.sh
# genera /tmp/nexusnet-client-kubeconfig.yaml (puedes cambiar salida con args)
./scripts/create-sa-kubeconfig.sh kube-system /tmp/nexusnet-client-kubeconfig.yaml nexusnet-client
```

2) Preparar un archivo con los hosts clientes (uno por línea):

```
# ejemplo hosts.txt
user1@192.168.1.11
user2@192.168.1.12
192.168.1.13    # usa el usuario actual
```

3) Distribuir el kubeconfig y añadir /etc/hosts en clientes

```bash
chmod +x scripts/distribute-kubeconfig.sh
# SERVER_IP = IP de tu equipo principal o IP de MetalLB
./scripts/distribute-kubeconfig.sh hosts.txt 192.168.1.250 nexusnet.test /tmp/nexusnet-client-kubeconfig.yaml
```

4) En cada cliente (ya hecho por el script):
- `kubectl get nodes` ó `kubectl --kubeconfig=~/.kube/config get pods -A`

Notas de seguridad:
- El kubeconfig generado usa un token asociado a un `ServiceAccount` con `view` (lectura). No da permisos de administrador.
- Si necesitas privilegios adicionales crea una `ClusterRole` y un `ClusterRoleBinding` específico.

Red y firewall:
- Asegurate de que los clientes pueden contactar con la API (puerto 6443) o bien usa una VPN/SSH tunneling.
- Abre 80/443 en el server si otros equipos deben acceder a la app vía Traefik/Ingress.

Registro de imágenes:
- Para que los nodos obtengan imágenes locales, corre un registry en el server y pushea las imágenes allí, o configura todos los nodos para acceder al mismo registry.

¿Quieres que genere un playbook Ansible que automatice la instalación y la distribución del kubeconfig?