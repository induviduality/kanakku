FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ARG VITE_DEV_MODE=
ARG VITE_DEV_EMAIL=dev@kanakku.com
ARG VITE_DEV_PASSWORD=dev-password
ENV VITE_DEV_MODE=$VITE_DEV_MODE \
    VITE_DEV_EMAIL=$VITE_DEV_EMAIL \
    VITE_DEV_PASSWORD=$VITE_DEV_PASSWORD
RUN bun run build


FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
