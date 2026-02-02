#!/bin/sh
set -e
URL=$(curl -Ls -o /dev/null -w "%{url_effective}" https://en.wikipedia.org/wiki/Special:Random)
TODO="{\"text\": \"Read the article at $URL\"}"
curl -X POST -H "Content-Type: application/json" -d "$TODO" http://todo-backend-svc:3000/todos