### ---------- 1) Build React UI ----------
FROM node:18 AS build-ui
WORKDIR /app/client

# Debug: show folder before build
COPY client/package*.json ./
RUN ls -la

RUN npm install

COPY client ./

# Debug: show folder before building
RUN ls -la

RUN npm run build

# Debug: confirm build folder exists
RUN echo "---- BUILD FOLDER ----" && ls -la /app/client/build || echo "Build missing!"


### ---------- 2) Build Node.js API ----------
FROM node:18
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY --from=build-ui /app/client/build ./client/build

RUN echo "---- FINAL CLIENT FOLDER ----" && ls -la ./client

EXPOSE 3001
CMD ["node", "index.js"]
