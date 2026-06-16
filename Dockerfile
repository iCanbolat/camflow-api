# --- Build stage ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# pnpm via corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

# --- Runtime stage ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# argon2 needs a libc that matches the build stage (same base image satisfies it).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
# Run pending migrations, then boot.
CMD ["sh", "-c", "node node_modules/drizzle-kit/bin.cjs migrate && node dist/main"]
