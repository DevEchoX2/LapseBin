FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /app/data
ENV PORT=5000
ENV DATA_DIR=/app/data
ENV WAITLIST_FILE=/app/data/waitlist.json
ENV INSTANCE_POOL_FILE=/app/data/instance-pool.json
ENV SESSION_LOG_FILE=/app/data/session-log.json
EXPOSE 5000
CMD ["npm", "start"]
