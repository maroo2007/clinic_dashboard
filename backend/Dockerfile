FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application source
COPY src ./src/

EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/index.js"]
