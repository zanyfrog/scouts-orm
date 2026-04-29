FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./
COPY server.js ./
COPY data ./data

ENV PORT=4174

EXPOSE 4174

RUN chown -R node:node /app

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4174) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
