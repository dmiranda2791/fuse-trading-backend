FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
# Copy Husky files first
COPY .husky/ ./.husky/

# Use --ignore-scripts to avoid running prepare script during install
RUN npm install --only=development --ignore-scripts

COPY . .

RUN npm run build

FROM node:20-alpine AS production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
COPY .husky/ ./.husky/

# Use --ignore-scripts to avoid running prepare script during install
RUN npm install --only=production --ignore-scripts

# Only copy the built application from the development stage
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/src/main.js"] 