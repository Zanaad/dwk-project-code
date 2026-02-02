FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add curl
COPY todo.sh ./todo.sh
RUN chmod +x ./todo.sh
CMD ["./todo.sh"]