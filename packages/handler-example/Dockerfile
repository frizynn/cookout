# The example handler: `node app/main.ts` on Node's type stripping, with the cookout SDK from the
# workspace source. Build from the repo root, as the SDK lives there:
#   docker build -f packages/handler-example/Dockerfile -t cookout-handler .
# Recipes: docs/verification.md ("Deploy the example handler to Fly").

FROM node:22-slim AS prod-deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
# Every workspace package.json, so the frozen lockfile matches; only the handler's runtime deps install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/handler-example/package.json packages/handler-example/
COPY packages/e2e/package.json packages/e2e/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --prod --filter "@ai-hero/cookout-handler-example..."

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app ./
COPY --chown=node:node app ./app
COPY --chown=node:node packages/handler-example/app ./packages/handler-example/app
USER node
EXPOSE 8787
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
WORKDIR /app/packages/handler-example
CMD ["node", "app/main.ts"]
