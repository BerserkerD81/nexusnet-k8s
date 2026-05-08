#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

# Demo testing script for k3d deployment
# Demonstrates: scaling, HPA, pod disruption, health checks
# Usage: ./k3d-test-demo.sh <CLUSTER_NAME>

CLUSTER=${1:-nexusnet}
export KUBECONFIG=/tmp/k3d-"$CLUSTER".yaml

echo "=== NexusNet K3D Test Demo ==="
echo ""

# Check cluster
echo "1. Cluster status:"
kubectl cluster-info
echo ""

# Check pods
echo "2. Current pods:"
kubectl get pods -o wide
echo ""

# Test manual scaling
echo "3. Testing manual scaling (5 replicas)..."
kubectl scale deployment nexusnet-api --replicas=5
sleep 5
kubectl get pods -o wide
echo ""

# Wait for HPA to adjust
echo "4. Waiting 10s for HPA to check metrics..."
sleep 10
kubectl get hpa -o wide
echo ""

# Scale down
echo "5. Scaling down to 2 replicas..."
kubectl scale deployment nexusnet-api --replicas=2
sleep 5
kubectl get pods -o wide
echo ""

# Delete a pod to test recovery
echo "6. Deleting a pod to test recovery..."
POD=$(kubectl get pods -l app=nexusnet-api -o jsonpath='{.items[0].metadata.name}')
echo "Deleting pod: $POD"
kubectl delete pod "$POD"
sleep 5
echo "Pods after deletion (should recover):"
kubectl get pods -o wide
echo ""

# Check service and ingress
echo "7. Service and Ingress:"
kubectl get svc
echo ""
kubectl get ing
echo ""

# Show logs
echo "8. Recent API logs:"
POD=$(kubectl get pods -l app=nexusnet-api -o jsonpath='{.items[0].metadata.name}')
kubectl logs "$POD" --tail=20
echo ""

echo "=== Demo complete ==="
echo "To port-forward: kubectl port-forward svc/nexusnet-api 3000:3000"
echo "To test: curl http://localhost:3000/health"
