# Todo App

Node.js frontend service that serves a static UI (HTML/JS/CSS) and proxies todo API calls to `todo-backend`.

## Features

- Serves static UI from `public/index.html`
- Proxies `GET /todos` and `POST /todos` to `todo-backend`
- Daily image fetch & cache (`/image`) with 10-minute TTL
- 140-char limit with live counter, responsive layout

## Configuration

All configuration is externalized via environment variables or ConfigMap:

**Direct env (deployment)**:

- `PORT` — server port (default: 3000)
- `IMAGE_DIR` — image cache directory (default: /var/lib/data)
- `TODO_BACKEND_URL` — backend service URL (default: http://todo-backend-svc:3000)

**ConfigMap (`todo-config`)**:

- `CACHE_DURATION_MS` — image cache TTL in milliseconds (default: 600000 = 10 minutes)
- `IMAGE_URL` — image source URL (default: https://picsum.photos/1200)

## Deploy to Kubernetes

**With Kustomize (recommended)**:

```bash
cd ../  # Go to todo-project root
kubectl apply -k .
```

**Individual app only**:

```bash
kubectl apply -k k8s/
```
