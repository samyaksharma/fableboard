FROM node:22-slim
RUN corepack enable
WORKDIR /app

# Manifests first so dependency installation is cached between code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile --filter @fableboard/server...

COPY packages/shared packages/shared
COPY packages/server packages/server
RUN pnpm --filter @fableboard/shared build && pnpm --filter @fableboard/server build

ENV NODE_ENV=production
# The image runs behind the platform's reverse proxy (one hop).
ENV TRUST_PROXY=1
CMD ["node", "packages/server/dist/index.js"]
