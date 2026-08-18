# Multi-stage: node builds the static bundle, nginx serves it.
#
# The runtime image contains no node and no source — just static files and a web
# server, which is a fraction of the size and attack surface of shipping the dev
# server to production.

# ------------------------------------------------------------------ build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so a source change does not invalidate the dependency layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Baked in at build time: Vite inlines VITE_* variables into the bundle, so this
# cannot be changed by an env var at container start. For a different API host,
# rebuild with --build-arg VITE_API_BASE_URL=...
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---------------------------------------------------------------- runtime stage
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
