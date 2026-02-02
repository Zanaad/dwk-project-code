# Todo Backend

Node.js REST API that stores todos in a Postgres database and exposes HTTP endpoints for the todo-app frontend to consume.

## Endpoints

- `GET /todos` — return all todos as JSON
- `POST /todos` — create a todo `{ text }` (max 140 chars), returns `{ id, text }`

## Features

- **Request logging**: JSON logs every todo creation attempt (created or rejected)
- **Validation**: Enforces 140 character limit on todo text
- **Postgres StatefulSet**: Single replica with encrypted secrets and persistent volumes
- **Auto-initialization**: Creates todos table on startup
- **Persistence**: Todos survive pod restarts

## Deploy to Kubernetes

**With Kustomize (recommended)**:

```bash
cd ../  # Go to todo-project root
kubectl apply -k .
```

**Individual app only**:

```bash
kubens todo
kubectl apply -k k8s/
```
