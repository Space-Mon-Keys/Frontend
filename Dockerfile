FROM node:22-alpine

WORKDIR /app

EXPOSE 5173

COPY app/package.json app/package-lock.json ./

RUN npm install --silent

COPY . ./

CMD ["npm", "run", "dev"]