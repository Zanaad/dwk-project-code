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

Event broadcasting service that listens to NATS messages and sends notifications to Discord. Subscribes to `todo.created` and `todo.updated` events, forwarding them to a Discord webhook (or console in staging environments).

### 2. Todo App (`todo-app/`)

Frontend application serving the user interface for todo management. Serves static HTML/JavaScript and proxies API requests to the backend. Includes image caching (10-minute TTL) and Kubernetes health probes for readiness/liveness checks.

### 3. Todo Backend (`todo-backend/`)

RESTful API service handling business logic and data persistence. Uses PostgreSQL 16 for storage and publishes events to NATS on todo state changes. Provides CRUD operations for todos with automatic database initialization and health checks.

### 4. Todo Job (`todo-job/`)

Kubernetes CronJob that runs hourly to create Wikipedia article reading reminders. Fetches random article URLs and creates todo items via the backend API using a simple bash script.

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

## Development

**Prerequisites:** Docker, Node.js 20+, Git

Each service can be built with `docker build` from its respective directory. For local testing, services require PostgreSQL 16 and NATS (can be run via Docker).

## Deployment

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
