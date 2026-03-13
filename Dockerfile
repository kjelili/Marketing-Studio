FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js index.html ./
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:8080/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })"
CMD ["node", "server.js"]
