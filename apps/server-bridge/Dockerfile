# syntax=docker/dockerfile:1.7

FROM docker:27-cli AS docker-cli

FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY apps/server-bridge/package.json ./apps/server-bridge/package.json
COPY apps/user-interface/package.json ./apps/user-interface/package.json

RUN npm ci --omit=dev --workspace=apps/server-bridge --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Keep the runtime image minimal for Trivy and production hardening. The app only
# shells out to the Docker client; it does not need a Docker daemon, containerd,
# runc, iptables, or the full docker.io Debian package inside this image.
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates git tini \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server-bridge/node_modules ./apps/server-bridge/node_modules
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY apps/server-bridge ./apps/server-bridge

RUN chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "start", "--workspace=apps/server-bridge"]
