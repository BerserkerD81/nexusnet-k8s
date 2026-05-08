# NexusNet - Escalabilidad y Arquitectura Distribuida 🚀

## Visión General

NexusNet está diseñado para escalar horizontalmente en un entorno Kubernetes con múltiples replicas del backend. La arquitectura es completamente distribuida y sin estado (stateless).

---

## 🏗️ Componentes de la Arquitectura

### 1. **Backend API (Node.js + Express)**
- **Instancias**: Múltiples replicas en Kubernetes
- **Estado**: Completamente stateless
- **Base de datos**: PostgreSQL centralizada
- **Cache/Session**: Redis compartido
- **WebSocket**: Socket.io con Redis adapter

### 2. **Frontend (React + Vite)**
- **Hosted**: Nginx en Kubernetes
- **Comunicación**: WebSocket + REST API
- **Real-time**: Socket.io client

### 3. **Base de Datos**
- **PostgreSQL**: Instancia central o managed service (AWS RDS, Google Cloud SQL, etc.)
- **Replicación**: Configurada a nivel de infraestructura

### 4. **Cache & Pub/Sub**
- **Redis**: Instancia central o cluster (Redis Sentinel para HA)
- **Adaptadores**: Socket.io usa Redis para comunicación entre replicas

---

## 🔄 Flujo de Escalabilidad

```
┌─────────────────────────────────────────────────────────────┐
│                   Kubernetes Cluster                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────  Ingress (Traefik) ──────────────┐         │
│  │         (Load Balancing + Routing)              │         │
│  └──────────────────────┬──────────────────────────┘         │
│                         │                                    │
│     ┌───────────────────┼───────────────────┐                │
│     │                   │                   │                │
│  ┌──▼───┐            ┌──▼───┐            ┌──▼───┐           │
│  │ Pod  │ ◄─────────►│ Pod  │ ◄─────────►│ Pod  │           │
│  │ :3000│ via Redis  │ :3000│ via Redis  │ :3000│           │
│  └──┬───┘            └──┬───┘            └──┬───┘           │
│     │                   │                   │                │
│     └───────────────────┼───────────────────┘                │
│                         │                                    │
│         ┌───────────────┼───────────────┐                    │
│         │               │               │                    │
│      ┌──▼──────────────┐│              │                    │
│      │  PostgreSQL     ││              │                    │
│      │   (Primary)     ││              │                    │
│      └─────────────────┘│              │                    │
│                         │              │                    │
│         ┌───────────────┴──────┐       │                    │
│         │                      │       │                    │
│      ┌──▼──────────────┐   ┌───▼─────┐│                    │
│      │ PostgreSQL      │   │ Redis   ││                    │
│      │ (Standby)       │   │ Cluster ││                    │
│      └─────────────────┘   └─────────┘│                    │
│                                       │                    │
└───────────────────────────────────────┴────────────────────┘
```

---

## ✅ Características de Escalabilidad

### 1. **Socket.io Redis Adapter** (Crítico para Distributed Messaging)

```typescript
// En index.ts
import { createAdapter } from '@socket.io/redis-adapter';

io.adapter(createAdapter(redis, redis.duplicate()));
```

**Beneficios:**
- ✅ Eventos en tiempo real se propagan entre TODAS las replicas
- ✅ Un usuario en Pod 1 puede recibir eventos de usuario en Pod 2
- ✅ Rooms y namespaces funcionan globalmente
- ✅ No hay pérdida de mensajes entre replicas

### 2. **Presencia Distribuida (Redis)**

```typescript
// Los usuarios online se almacenan en Redis (no en memoria)
redis.sadd(`presence:${userId}`, socket.id);
redis.expire(`presence:${userId}`, 300); // 5 min TTL
```

**Ventajas:**
- ✅ La presencia persiste entre reinicios de pods
- ✅ Múltiples pods pueden consultar el estado de presencia
- ✅ Escalable a millones de usuarios

### 3. **Rooms de Broadcast para Feeds**

```typescript
// Todos los clientes en 'feed' room reciben nuevas publicaciones
socket.join('feed');
socket.join('explore');
socket.join('global-notifications');

// Broadcast a todos en la 'feed' room (entre todos los pods)
io.to('feed').emit('new_post', post);
```

**Por qué funciona:**
- ✅ Cada pod mantiene sus clientes en rooms locales
- ✅ Redis adapter sincroniza rooms entre todos los pods
- ✅ Un evento en Pod 1 llega a todos los clientes en Pod 2-N

### 4. **Sin Estado en la Capa de Aplicación**

```typescript
// Todo lo importante está en:
// - PostgreSQL (datos persistentes)
// - Redis (cache + presencia + pub/sub)
// - JWT tokens (en cliente, no en servidor)

// Podemos escalar/destruir pods sin perder datos
```

---

## 📊 Capacidades de Escalabilidad

| Métrica | Capacidad | Limitación |
|---------|-----------|-----------|
| **Usuarios Conectados** | Teórico: 100k+ por pod | Redis throughput |
| **Mensajes/segundo** | 10k+/sec (Redis) | Redis CPU/bandwidth |
| **WebSocket Connections** | Scaling horizontal ilimitado | Kubernetes resources |
| **API Requests** | Horizontal scaling | PostgreSQL connections |
| **Database Connections** | 100-500 (pool) | PostgreSQL config |
| **Real-time Events** | Propagación <50ms | Network latency |

---

## 🔧 Configuración Recomendada

### **Desarrollo Local**
```bash
# 1 pod backend + PostgreSQL + Redis
docker-compose up
```

### **Producción (Kubernetes)**

**Replicas del Backend:**
```yaml
# deployment.yaml
replicas: 3-5  # Aumentar según carga
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

**PostgreSQL:**
```yaml
# Production: RDS/Cloud SQL with replicas
# Min: db.t3.medium (2 vCPU, 4GB RAM)
# High availability: Multi-AZ + Read replicas
```

**Redis:**
```yaml
# Option 1: Managed (AWS ElastiCache, GCP Memorystore)
# Option 2: Self-hosted with Sentinel/Cluster
# Min: 2GB memory
# HA: Redis Sentinel with 3 nodes
```

---

## 🚀 Escalamiento Automático

```yaml
# Kubernetes HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nexusnet-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nexusnet-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## 🔐 Consideraciones de Seguridad

### **Sticky Sessions**
```yaml
# Traefik IngressRoute con sticky sessions
# Para WebSocket polling (aunque WebSocket es preferido)
sessionCookieName: NEXUSNET_SESSION
sessionCookieTTL: "3600"
```

### **CORS** (Configurado)
```typescript
cors: { origin: true, credentials: true }
```

### **JWT Sin Estado**
- Tokens signed con HS256
- No requieren almacenamiento de sesión
- Facilita scaling horizontal

---

## 📈 Monitoreo y Métricas

### **Métricas Clave**

```typescript
// Ya implementadas en config/metrics.ts:
- websocketConnections (contador activo)
- activeUsers (usuarios online)
- httpDuration (latencia de API)
```

### **Alertas Recomendadas**

1. **WebSocket Connection Loss**
   - Si cae por debajo del 90% por >1 min

2. **Redis Latency**
   - Si promedio supera 50ms

3. **Database Connection Pool**
   - Si alcanza >80% de capacidad

4. **Pod Restart Rate**
   - Si reinicia >2 veces en 10 min

---

## 🔄 Estrategia de Deployment

### **Rolling Update (Recomendado)**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0  # 0 downtime
```

### **Pasos:**
1. Pod nuevo inicia y se conecta a Redis
2. Traefik gradualmente enruta tráfico al nuevo pod
3. Clientes WebSocket reconectan (Socket.io lo maneja)
4. Viejo pod drena conexiones y se termina

---

## 🎯 Pruebas de Carga

```bash
# Load testing con Artillery
artillery quick --count 100 --num 1000 https://api.nexusnet.com

# WebSocket load testing
npm install -g artillery
artillery run websocket-load-test.yml
```

---

## 📚 Referencias

- **Socket.io Adapter**: https://socket.io/docs/v4/redis-adapter/
- **Kubernetes HPA**: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
- **Redis Persistence**: https://redis.io/docs/management/persistence/
- **PostgreSQL Replication**: https://www.postgresql.org/docs/current/warm-standby.html

---

## ✅ Checklist de Producción

- [ ] Redis Cluster configurado (3 nodos mínimo)
- [ ] PostgreSQL con backup automático (diario)
- [ ] Múltiples replicas del backend (3-5 mínimo)
- [ ] HPA configurada para auto-scaling
- [ ] Monitoreo y alertas en place (Prometheus + Grafana)
- [ ] Logging centralizado (ELK/Loki)
- [ ] Certificate SSL/TLS (Let's Encrypt)
- [ ] CDN para assets estáticos (CloudFlare)
- [ ] Rate limiting en API
- [ ] DDoS protection activa

---

**Resultado Final:** NexusNet puede escalar de 100 a 1M+ usuarios con la arquitectura actual, limitado principalmente por recursos de infraestructura (Kubernetes, PostgreSQL, Redis). ✅
