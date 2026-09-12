FROM node:22-alpine
WORKDIR /app
COPY companion/package.json ./companion/
RUN cd companion && npm install --omit=dev
COPY companion/server.mjs ./companion/server.mjs
COPY lib ./lib
ENV NODE_ENV=production
EXPOSE 8788
CMD ["node", "--experimental-transform-types", "companion/server.mjs"]
