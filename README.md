# DevOps with Kubernetes - Project Code

This repository contains the application source code for the **Todo Project**, a microservices-based application following GitOps principles. The Kubernetes manifests and infrastructure configuration are maintained separately in the [dwk-project-gitops](https://github.com/Zanaad/dwk-project-gitops) repository.

## Overview

The Todo Project is a full-stack application demonstrating Kubernetes deployment patterns, microservices architecture, and GitOps workflows. It consists of four main services working together to provide a complete todo management system with real-time updates and scheduled tasks.

**Architecture:**

- **Frontend:** Node.js web application serving static HTML/JavaScript
- **Backend:** Node.js REST API with PostgreSQL database
- **Broadcaster:** NATS-based service for real-time notifications (Discord webhook integration)
- **Job:** Scheduled Wikipedia article reminder running as a CronJob

## Services

### 1. Broadcaster (`broadcaster/`)

Event broadcasting service that listens to NATS messages and sends notifications to Discord.

**Technology Stack:**

- Node.js
- NATS client for message streaming
- Axios for HTTP requests

**Key Features:**

- Listens to `todo.created` and `todo.updated` NATS events
- Sends formatted messages to Discord webhook
- Falls back to console logging if webhook URL not configured (useful for staging)
- Queue group for handling multiple broadcaster instances

**Environment Variables:**

- `DISCORD_WEBHOOK_URL`: Discord webhook URL (optional in staging)
- `NATS_URL`: NATS server connection string (default: `nats://my-nats.todo.svc.cluster.local:4222`)

### 2. Todo App (`todo-app/`)

Frontend application providing the user interface for todo management.

**Technology Stack:**

- Node.js HTTP server
- HTML/JavaScript frontend
- Image caching with metadata tracking
- Proxies requests to backend API

**Key Features:**

- Serves static HTML/JavaScript from `public/` directory
- Proxies todo API calls to backend (`/todos`, `/todos/:id`)
- Serves cached images with 10-minute TTL
- Health and readiness probes for Kubernetes

**Endpoints:**

- `/`: Main todo application interface
- `/todos`: GET/POST proxy to backend
- `/todos/:id`: PUT proxy to backend (mark as done)
- `/image`: Cached image (Picsum Photos, 10-minute cache)
- `/healthz`: Liveness probe
- `/readyz`: Readiness probe (checks backend connectivity)

**Environment Variables:**

- `TODO_BACKEND_URL`: Backend service URL (default: `http://todo-backend-svc:3000`)
- `IMAGE_URL`: Image source URL (default: `https://picsum.photos/1200`)
- `CACHE_DURATION_MS`: Image cache duration in milliseconds (default: `600000` = 10 minutes)
- `IMAGE_DIR`: Directory to cache images (default: `/var/lib/data`)
- `PORT`: Server port (default: `3000`)

### 3. Todo Backend (`todo-backend/`)

Backend API service handling business logic and data persistence.

**Technology Stack:**

- Node.js HTTP server
- PostgreSQL 16 for data storage (using pg client)
- NATS publisher for event streaming

**Key Features:**

- RESTful API for todo operations (CRUD)
- Raw SQL queries for database operations
- Event publishing to NATS on todo state changes
- Health and readiness probes
- Automatic table initialization

**Endpoints:**

- `GET /todos`: List all todos
- `POST /todos`: Create new todo
- `PUT /todos/:id`: Mark todo as done
- `GET /healthz`: Health check
- `GET /readyz`: Readiness check

**Environment Variables:**

- `POSTGRES_HOST`: PostgreSQL hostname (default: `postgres-svc`)
- `POSTGRES_DB`: Database name (default: `todo`)
- `POSTGRES_USER`: Database username (default: `postgres`)
- `POSTGRES_PASSWORD`: Database password (required)
- `NATS_URL`: NATS server connection string (default: `nats://my-nats.todo.svc.cluster.local:4222`)
- `PORT`: Server port (default: `3000`)

**Notes:**

- NATS connection is optional—server runs without it if unavailable
- Todos have a 140-character limit
- `/readyz` checks database connectivity

### 4. Todo Job (`todo-job/`)

Scheduled job that creates reminders to read Wikipedia articles.

**Technology Stack:**

- Bash script with curl and jq
- Runs as Kubernetes CronJob
- HTTP requests to backend API

**Key Features:**

- Hourly execution (runs at the start of each hour)
- Fetches random Wikipedia article URLs from `https://en.wikipedia.org/wiki/Special:Random`
- Creates todo items via backend API
- Minimal dependencies for container efficiency

## CI/CD Workflow

This repository uses **GitHub Actions** for automated building, testing, and deployment across staging and production environments.

### Workflow Triggers

- **Staging:** Triggered on push to `main` branch
- **Production:** Triggered on version tags matching `v*.*.*` pattern

### Pipeline Stages

#### 1. Build & Publish (Staging)

- Builds Docker images for all four services
- Tags images with `staging-{commit-sha}`
- Pushes to Google Artifact Registry: `europe-west3-docker.pkg.dev/dwk-gke-485813/todo-project`

#### 2. Build & Publish (Production)

- Builds Docker images for all services
- Tags images with the version tag (e.g., `v1.2.3`)
- Pushes to Google Artifact Registry

#### 3. Update GitOps Repo (Staging)

- Clones [dwk-project-gitops](https://github.com/Zanaad/dwk-project-gitops)
- Updates image tags in `overlays/staging/kustomization.yaml`
- Commits and pushes changes using `GITOPS_PAT`

#### 4. Update GitOps Repo (Production)

- Updates image tags in `overlays/prod/kustomization.yaml`
- ArgoCD automatically syncs the changes to production cluster

### Required Secrets

Configure these in GitHub repository settings:

- `GKE_PROJECT`: Google Cloud project ID (`dwk-gke-485813`)
- `GKE_SA_KEY`: Service account JSON key with Artifact Registry write permissions
- `GITOPS_PAT`: Personal access token with write access to dwk-project-gitops repo

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and npm
- Git
- Access to GKE cluster for testing

##PostgreSQL 16 (for local testing)

- NATS server (for local testing)

### Local Development

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Zanaad/dwk-project-code.git
   cd dwk-project-code
   ```

2. **Build individual services:**

   ```bash
   # Broadcaster
   cd broadcaster && docker build -t broadcaster:local .

   # Todo App
   cd todo-app && docker build -t todo-app:local .

   # Todo Backend
   cd todo-backend && docker build -t todo-backend:local .

   # Todo Job
   cd todo-job && docker build -t todo-job:local .
   ```

3. **Run services locally (example for backend):**

   ```bash
   cd todo-backend
   npm install

   # Set environment variables
   export POSTGRES_HOST=localhost
   export POSTGRES_DB=todo
   export POSTGRES_USER=postgres
   export POSTGRES_PASSWORD=postgres
   export NATS_URL=nats://localhost:4222
   export PORT=3000

   npm start
   ```

4. **Set up local PostgreSQL and NATS (optional):**

   ```bash
   # Start PostgreSQL and NATS with Docker
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
   docker run -d -p 4222:4222 nats:latest -js
   ```

Deployment is automated through **GitOps** using ArgoCD. This repository only contains application code; Kubernetes manifests are in [dwk-project-gitops](https://github.com/Zanaad/dwk-project-gitops).

### Deployment Flow

1. **Code Changes:** Push changes to `main` branch or create version tag
2. **CI Pipeline:** GitHub Actions builds and publishes Docker images
3. **GitOps Update:** Workflow updates image tags in dwk-project-gitops
4. **ArgoCD Sync:** ArgoCD detects changes and syncs to cluster
5. **Verification:** Check pod status and logs in target namespace

### Staging Deployment

```bash
# Push to main branch
git push origin main

# Check GitHub Actions workflow
# Visit: https://github.com/Zanaad/dwk-project-code/actions

# Verify deployment in staging
kubectl get pods -n todo-staging
```

### Production Deployment

```bash
# Create and push version tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Verify deployment in production
kubectl get pods -n todo
```

## Configuration

### Environment-Specific Settings

Environment-specific configurations are managed in the GitOps repository using Kustomize overlays:

- **Staging:** Lower resource limits, empty Discord webhook, todo-staging namespace
- **Production:** Production resources, configured webhooks, todo namespace

### Image Registry

All images are stored in Google Artifact Registry:

- Repository: `europe-west3-docker.pkg.dev/dwk-gke-485813/todo-project`
- Staging tags: `staging-{commit-sha}`
- Production tags: `v{major}.{minor}.{patch}`
