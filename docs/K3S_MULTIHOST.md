# k3s multi-host guide (server + agents) — NexusNet

Resumen rápido:
- Instala `k3s` en tu equipo principal (server) con `scripts/k3s-server.sh`.
- En los equipos clientes ejecuta `scripts/k3s-agent.sh SERVER_IP TOKEN` para unirlos.
- Opcional: instala MetalLB para asignar IPs de la LAN a servicios Ingress.

1) En el equipo principal (server):

```bash
# darle permiso ejecutable a los scripts
chmod +x scripts/k3s-server.sh scripts/k3s-agent.sh

# Instalar k3s server y configurar MetalLB (opcional)
# Reemplaza DOMAIN y el rango IP por tu red local
./scripts/k3s-server.sh "nexusnet.test" "192.168.1.240-192.168.1.250"
```

El script deja el kubeconfig en `/etc/rancher/k3s/k3s.yaml` y el token en `/var/lib/rancher/k3s/server/node-token`.

2) En cada nodo trabajador (agent):

```bash
# copia el token desde el server (ejemplo usando scp)
scp user@SERVER:/var/lib/rancher/k3s/server/node-token ./node-token
# luego en el worker:
./scripts/k3s-agent.sh SERVER_IP "$(cat node-token)"
```

3) Firewall y DNS
- Asegurate de abrir puerto `6443` (kube apiserver) solo entre los nodos o usar VPN.
- Abre `80` y `443` si quieres que Traefik/Ingress sea accesible desde la LAN.
- En cada cliente apunta `DOMAIN` al IP público asignado (MetalLB IP o IP del server) agregando a `/etc/hosts`:

```bash
# en cada cliente (reemplaza IP y DOMAIN)
echo "192.168.1.250 nexusnet.test" | sudo tee -a /etc/hosts
```

4) Imágenes Docker y registro
- Para que todos los nodos puedan obtener las imágenes (`nexusnet-api:local`), usa uno de estos:
  - Pulir imágenes a un registro accesible (ej. registry en server): `docker run -d -p 5000:5000 --name registry registry:2`
  - Subir imágenes al registry y usar la URL `SERVER:5000/name:tag`.
  - O construir imágenes en el server y configurar NodePort/Ingress para desplegar desde ahí.

5) Usar `setup.sh`
- `setup.sh` original usa `k3d` (single-host). Para multi-host con `k3s`:
  - Ejecuta `setup.sh` en el server solo si adaptas las partes que asumen `k3d` (imports de imágenes con k3d no aplican).
  - Mejor flujo: construir y push de imágenes a un registry accesible y luego aplicar manifests del directorio `manifests/`.

6) Seguridad
- No compartas `/etc/rancher/k3s/k3s.yaml` admin con permisos amplios; crea cuentas con RBAC si vas a dar acceso `kubectl` a otros usuarios.

7) ¿Quieres que genere?
- Un playbook Ansible para instalar server+agents y configurar MetalLB y registry.
- Un script para empujar imágenes locales al registry en el server y actualizar manifests.
