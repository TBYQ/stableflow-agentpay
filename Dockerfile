# Build the React checkout once, then let the Go service host it with the API.
FROM node:22-alpine AS web-build
WORKDIR /src/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.22-alpine AS api-build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /stableflow-api ./cmd/stableflow-api

FROM alpine:3.20
RUN adduser -D -H -u 10001 stableflow
WORKDIR /app
COPY --from=api-build /stableflow-api ./stableflow-api
COPY --from=web-build /src/web/dist ./web/dist
RUN mkdir -p /var/lib/stableflow && chown -R stableflow:stableflow /app /var/lib/stableflow
USER stableflow
EXPOSE 10000
CMD ["./stableflow-api"]
