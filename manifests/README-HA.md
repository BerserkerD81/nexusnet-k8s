# NexusNet — Alta Disponibilidad de Bases de Datos

## Arquitectura

```
                    ┌─────────────────────────────────────────┐
                    │           nexusnet-api (x3)              │
                    │  ioredis Sentinel  │  Prisma (primary)   │
                    └────────┬───────────┴──────────┬──────────┘
                             │                       │
              ┌──────────────▼───────┐    ┌──────────▼──────────────┐
              │    Redis Sentinel    │    │   PostgreSQL Primary     │
              │  sentinel-{0,1,2}   │    │      postgres-0          │
              │    puerto 26379      │    │    (escri + lectura)     │
              └──────┬──────┬────────┘    └──────────┬──────────────┘
                     │      │                         │ WAL streaming
              ┌──────▼──┐ ┌─▼───────┐        ┌───────▼────┐ ┌──────────────┐
              │ master  │ │réplicas │        │ postgres-1 │ │  postgres-2  │
              │redis-   │ │redis-   │        │ (hot       │ │  (hot        │
              │master-0 │ │replica- │        │  standby)  │ │   standby)   │
              │         │ │{0,1}    │        └────────────┘ └──────────────┘
              └─────────┘ └─────────┘
```

## Orden de aplicación

```bash
kubectl apply -f 01-storageclass.yaml
kubectl apply -f 02-postgres.yaml          # StatefulSet postgres (espera ~60s para que postgres-0 arranque)
kubectl apply -f 02b-db-network-policy.yaml
kubectl apply -f 03-redis.yaml             # StatefulSet redis-master + réplicas + sentinels
kubectl apply -f 04-secrets.yaml
kubectl apply -f 05-backend.yaml
kubectl apply -f 06-frontend.yaml
kubectl apply -f 07b-traefik-ws-middleware.yaml
kubectl apply -f 07-ingress.yaml
kubectl apply -f 08-hpa-pdb.yaml
```

## Verificar replicación PostgreSQL

```bash
# Ver estado del primary
kubectl exec postgres-0 -- psql -U postgres -c "SELECT client_addr, state, sent_lsn, replay_lsn FROM pg_stat_replication;"

# Ver lag de replicación en una réplica
kubectl exec postgres-1 -- psql -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"

# Ver que postgres-1 está en standby
kubectl exec postgres-1 -- psql -U postgres -c "SELECT pg_is_in_recovery();"
# → t (true = es réplica)
```

## Verificar Redis Sentinel

```bash
# Ver master actual
kubectl exec redis-sentinel-0 -- redis-cli -p 26379 sentinel master nexusnet-master

# Ver réplicas conocidas
kubectl exec redis-sentinel-0 -- redis-cli -p 26379 sentinel replicas nexusnet-master

# Ver estado de los 3 sentinels
kubectl exec redis-sentinel-0 -- redis-cli -p 26379 sentinel sentinels nexusnet-master
```

## Simular un fallo

### Fallar PostgreSQL primary:
```bash
kubectl delete pod postgres-0
# Kubernetes lo reinicia automáticamente (< 30s)
# Las réplicas siguen sirviendo lecturas durante ese tiempo
kubectl get pods -w   # Ver el restart
```

### Fallar Redis master:
```bash
kubectl delete pod redis-master-0
# Sentinel detecta el fallo (5s) y promueve redis-replica-0 como nuevo master (~15s total)
# ioredis reconecta automáticamente
kubectl exec redis-sentinel-0 -- redis-cli -p 26379 sentinel master nexusnet-master
# → el campo "ip" ahora apuntará a redis-replica-0
```

## Notas importantes

- **PostgreSQL**: El failover automático completo (promote réplica a primary sin reiniciar postgres-0) 
  requiere Patroni. Los manifests están en `/nexusnet-backend/docker/patroni/`. Para dev local,
  el restart automático de Kubernetes es suficiente.

- **Redis**: Sentinel hace failover automático completo. ioredis en modo Sentinel se reconecta
  al nuevo master sin intervención manual.

- **Passwords**: Los secrets usan valores de desarrollo. En producción, usar sealed-secrets o
  un external secret manager (HashiCorp Vault, AWS Secrets Manager, etc.).
