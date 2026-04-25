FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY index.js ./
COPY server.js ./
COPY data ./data

ENV PORT=4174

EXPOSE 4174

CMD ["node", "server.js"]
