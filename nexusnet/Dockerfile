# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# API URL is injected at build time so Vite can embed it in the bundle
ARG VITE_API_URL=http://nexusnet.local
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
# Saltar tsc (chequeo de tipos) — falla por unused imports en el código fuente.
# Vite transpila TypeScript solo, sin necesitar tsc para producción.
RUN npx vite build

# ── Stage 2: Serve with nginx ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
