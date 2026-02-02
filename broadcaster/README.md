# Todo Broadcaster

Real-time Discord notifications for todo events via NATS messaging.

## Overview

A Kubernetes service that listens to todo create/update events from NATS and sends formatted Discord messages. Scales horizontally with zero duplicate messages using NATS queue groups.

## Quick Start

### Prerequisites

- NATS server running at `nats://my-nats.todo.svc.cluster.local:4222`
- Discord webhook URL

### Deploy

```bash
# 1. Update k8s/secret.yaml with your Discord webhook URL
# 2. Apply the manifests
kubectl apply -k k8s/

# 3. Scale replicas (optional)
kubectl scale deployment broadcaster --replicas=6 -n todo
```

## How It Works

1. Todo-backend publishes events to NATS (`todo.created`, `todo.updated`)
2. Broadcaster subscribes with queue group `broadcasters`
3. Each message delivered to exactly ONE replica (no duplicates)
4. Formatted Discord embed sent to webhook

## Features

- ✅ Real-time Discord notifications
- ✅ Scalable to 6+ replicas without duplicates
- ✅ NATS queue groups for load distribution
- ✅ Graceful error handling

## Environment Variables

- `NATS_URL`: NATS server URL (default: `nats://my-nats.todo.svc.cluster.local:4222`)
- `DISCORD_WEBHOOK_URL`: Discord webhook URL (required, from secret)

## Troubleshooting

Check logs:

```bash
kubectl logs -f deployment/broadcaster -n todo
```

Verify NATS connection:

```bash
kubectl logs deployment/todo-backend -n todo | grep -i nats
```

Check Discord webhook:

```bash
kubectl get secret broadcaster-secret -n todo -o jsonpath='{.data.discord-webhook-url}' | base64 -d
```

## Dependencies

- `nats` (v2.20.0): Message streaming
- `axios` (v1.6.0): Discord webhook calls
