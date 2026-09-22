# The prefix is compiled into asset URLs, so it is a build input, not runtime config.
ARG BASE_PATH=/v2

FROM node:24-alpine AS build
ARG BASE_PATH
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV VITE_BASE_PATH=$BASE_PATH
RUN pnpm build

FROM nginx:1.29-alpine AS runtime
ARG BASE_PATH
ENV BASE_PATH=$BASE_PATH

# node for the Consul registration script, envsubst for the nginx template.
RUN apk add --no-cache nodejs gettext

# Served from a directory matching the prefix, so `root` + `try_files` resolve
# the same paths nginx receives from the gateway without an alias rewrite.
COPY --from=build /app/dist /tmp/dist
RUN PREFIX=$(printf '%s' "$BASE_PATH" | sed 's#^/*##; s#/*$##') \
  && mkdir -p "/usr/share/nginx/html/$(dirname "$PREFIX")" \
  && mv /tmp/dist "/usr/share/nginx/html/$PREFIX"

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/config.json.template /opt/openlmis/config.json.template
COPY docker/registration.mjs /opt/openlmis/registration.mjs
COPY docker/entrypoint.sh /opt/openlmis/entrypoint.sh
RUN chmod +x /opt/openlmis/entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost/healthz || exit 1

ENTRYPOINT ["/opt/openlmis/entrypoint.sh"]
