FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN chmod +x scripts/docker-start.sh

EXPOSE 3000

CMD ["scripts/docker-start.sh"]