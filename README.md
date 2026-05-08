# NexusNet — Kubernetes Local Setup

Deploy completo de NexusNet (frontend + backend + PostgreSQL + Redis) en un
cluster Kubernetes local usando **k3d**, con **Kubernetes Dashboard** como
interfaz gráfica de gestión.

---

## Arquitectura

```
                    nexusnet.local (puerto 80)
                           │
                   ┌───────▼────────┐
                   │  nginx Ingress  │
                   └───┬───────┬────┘
                       │       │
            /api, /docs│       │/  (todo lo demás)
            /socket.io │       │
                 ┌─────▼──┐  ┌─▼──────────────┐
                 │ Backend │  │    Frontend     │
                 │ (x3 pod)│  │  (x2 pods)     │
                 │ :3000   │  │  nginx :80      │
                 └────┬────┘  └────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
     ┌────▼───┐  ┌────▼───┐  ┌───▼────┐
     │Postgres│  │ Redis  │  │ BullMQ │
     │ :5432  │  │ :6379  │  │(en API)│
     └────────┘  └────────┘  └────────┘
```

**Alta disponibilidad activada:**
- 3 réplicas del backend con anti-afinidad (no en el mismo nodo)
- 2 réplicas del frontend
- HPA: escala de 2 a 6 réplicas según CPU/RAM
- PDB: garantiza mínimo 1 pod activo durante mantenimiento
- Rolling updates: zero downtime
- Init containers: el backend espera a Postgres y Redis antes de iniciar

---

## Requisitos

| Herramienta | Instalación |
|-------------|-------------|
| Docker      | https://docs.docker.com/get-docker/ |
| k3d         | `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh \| bash` |
| kubectl     | https://kubernetes.io/docs/tasks/tools/ |

---

## Inicio rápido

```bash
# 1. Hacer ejecutable el script principal
chmod +x setup.sh nexusnet-commands.sh

# 2. Ejecutar setup (te pedirá las rutas al frontend y backend)
./setup.sh

# 3. Cargar comandos de gestión en tu terminal
source nexusnet-commands.sh

# 4. Verificar estado
nn-status
```

Cuando termine, añade el dominio elegido a `/etc/hosts`.
Ejemplo si usas `nexusnet.local`:
```
127.0.0.1  nexusnet.local
```

Si prefieres otro nombre, vuelve a ejecutar `setup.sh` con `DOMAIN=tu-dominio.local` y agrega ese mismo host a `/etc/hosts`.
Si luego usas `nn-rebuild-frontend`, exporta también `NEXUSNET_DOMAIN=tu-dominio.local` antes de cargar `nexusnet-commands.sh`.

---

## Acceso a las aplicaciones

| Servicio              | URL |
|-----------------------|-----|
| 🌐 Frontend (app)    | http://nexusnet.local |
| 🔌 API REST          | http://nexusnet.local/api/v1 |
| 📖 Swagger docs      | http://nexusnet.local/docs |
| ❤️ Health check      | http://nexusnet.local/health |
| 📊 K8s Dashboard     | Ver sección abajo |

---

## Kubernetes Dashboard (GUI)

El Dashboard te permite visualizar y gestionar todo el cluster con interfaz gráfica.

### Iniciar

```bash
# En una terminal separada:
export KUBECONFIG=/tmp/k3d-nexusnet.yaml
kubectl proxy
```

### Acceder

Abre en tu navegador:
```
http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

### Token de acceso

```bash
source nexusnet-commands.sh
nn-token
```

Copia el token y pégalo en el login del dashboard (selecciona "Token").

### Qué puedes hacer desde el dashboard

- 👀 Ver todos los pods, deployments, services en tiempo real
- 📈 Monitorear CPU y memoria de cada pod
- 📋 Ver logs de cualquier pod sin abrir terminal
- ⚡ Escalar deployments con un slider
- 🔄 Reiniciar pods / deployments
- 🔍 Inspeccionar ConfigMaps, Secrets, PVCs
- 🌐 Ver el estado del Ingress

---

## Comandos de gestión

Carga los comandos rápidos:
```bash
source nexusnet-commands.sh
```

| Comando | Descripción |
|---------|-------------|
| `nn-status` | Estado general del cluster |
| `nn-logs` | Logs en tiempo real del backend |
| `nn-scale 5` | Escalar backend a 5 réplicas |
| `nn-restart` | Reiniciar el backend |
| `nn-rebuild-backend <ruta>` | Rebuild + redeploy del backend |
| `nn-rebuild-frontend <ruta>` | Rebuild + redeploy del frontend |
| `nn-dashboard` | Abrir proxy del dashboard |
| `nn-token` | Ver token del dashboard |
| `nn-stress` | Generar carga (prueba HPA) |
| `nn-delete-pod <nombre>` | Eliminar pod (prueba auto-recuperación) |
| `nn-db-shell` | Shell de PostgreSQL |
| `nn-redis-cli` | Shell de Redis |
| `nn-top` | CPU/RAM en tiempo real |
| `nn-cleanup` | Eliminar todo el cluster |

---

## Estructura de archivos

```
nexusnet-k8s/
├── setup.sh                     # Script de instalación completa
├── nexusnet-commands.sh          # Comandos de gestión del día a día
├── README.md                    # Este archivo
├── frontend/
│   ├── Dockerfile               # Build multi-stage (Node → nginx)
│   └── nginx.conf               # Configuración nginx SPA
└── manifests/
    ├── 01-storageclass.yaml     # StorageClass local
    ├── 02-postgres.yaml         # PostgreSQL (PVC + Deployment + Service)
    ├── 03-redis.yaml            # Redis (PVC + Deployment + Service)
    ├── 04-secrets.yaml          # JWT secrets + ConfigMap
    ├── 05-backend.yaml          # API backend (3 réplicas)
    ├── 06-frontend.yaml         # Frontend nginx (2 réplicas)
    ├── 07-ingress.yaml          # Ingress (ruteo /api + / + /socket.io)
    ├── 08-hpa-pdb.yaml          # Autoscaling + disrupción mínima
    └── 09-dashboard-rbac.yaml   # ServiceAccount admin del dashboard
```

---

## Actualizar el backend o frontend

Cuando cambies código:

```bash
source nexusnet-commands.sh

# Actualizar backend
nn-rebuild-backend /ruta/a/nexusnet-backend

# Actualizar frontend
nn-rebuild-frontend /ruta/a/nexusnet
```

Esto hace automáticamente: build → import en k3d → rolling update.

---

## Probar alta disponibilidad

```bash
source nexusnet-commands.sh

# Ver pods actuales
nn-status

# Eliminar un pod (debería recrearse en segundos)
kubectl get pods  # anota el nombre de un pod
nn-delete-pod nexusnet-api-xxxxx-yyyy
kubectl get pods -w  # observa cómo se recupera

# Ver HPA en acción
nn-scale 5        # escala a 5 réplicas
kubectl get hpa -w # observa el autoscaler
nn-scale 2        # vuelve a 2

# Generar carga y ver HPA escalar
nn-stress
# (en otra terminal) kubectl get hpa -w
```

---

## Limpiar todo

```bash
source nexusnet-commands.sh
nn-cleanup
# o directamente:
k3d cluster delete nexusnet
```
