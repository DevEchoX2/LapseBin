FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /app/data
ENV PORT=5000
ENV WAITLIST_FILE=/app/data/waitlist.json
EXPOSE 5000
CMD ["npm", "start"]
