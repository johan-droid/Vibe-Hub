# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_BASE=
ENV VITE_API_BASE=${VITE_API_BASE}

COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY apps/user-interface/package.json ./apps/user-interface/package.json
COPY apps/server-bridge/package.json ./apps/server-bridge/package.json

RUN npm ci --workspace=apps/user-interface --include-workspace-root=false --legacy-peer-deps

COPY apps/user-interface ./apps/user-interface
RUN npm run build --workspace=apps/user-interface

FROM nginx:1.27-alpine AS runtime
RUN apk upgrade --no-cache
COPY apps/user-interface/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/user-interface/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
