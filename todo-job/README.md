# Wikipedia Todo CronJob

Kubernetes CronJob that generates a todo every hour to remind you to read a random Wikipedia article.

## How it works

- Fetches random Wikipedia article URL from `https://en.wikipedia.org/wiki/Special:Random`
- Creates a todo: "Read the article at <URL>"
- Runs hourly at the start of each hour

## Deploy to Kubernetes

**With Kustomize (recommended)**:

```bash
cd ../  # Go to todo-project root
kubectl apply -k .
```

**Individual component only**:

```bash
kubectl apply -k k8s/
```

## Test manually

```bash
kubectl create job --from=cronjob/todo-cronjob test-wiki-job -n todo
kubectl logs job/test-wiki-job -n todo
kubectl delete job test-wiki-job -n todo
```
