FROM node:24-alpine

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

EXPOSE 3100

CMD ["pnpm", "--filter", "@estudio/web", "dev", "--host", "0.0.0.0"]
