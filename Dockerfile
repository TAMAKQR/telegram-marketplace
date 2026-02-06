# syntax=docker/dockerfile:1

# One image, two modes:
# - build stage compiles the Vite app
# - runtime stage serves static files via nginx and injects runtime env to /env.js

FROM node:18-alpine AS build
WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:1.27-alpine AS runtime

# Render (and some other PaaS) injects PORT; nginx will read it via envsubst templates.
ENV PORT=80

# SPA routing + static caching (template rendered by /docker-entrypoint.d/20-envsubst-on-templates.sh)
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template

# App build
COPY --from=build /app/dist /usr/share/nginx/html

# Placeholder env.js (will be overwritten at container start)
RUN printf '%s\n' "window.__ENV__ = window.__ENV__ || {};" > /usr/share/nginx/html/env.js

# Runtime env injection (nginx image runs scripts in /docker-entrypoint.d)
COPY docker/99-env.sh /docker-entrypoint.d/99-env.sh
RUN chmod +x /docker-entrypoint.d/99-env.sh

EXPOSE 80
