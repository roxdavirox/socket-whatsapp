FROM node

RUN apt-get update
RUN apk add  --no-cache ffmpeg
RUN mkdir /app
WORKDIR /app

COPY package*.json ./
COPY . .
RUN npm install

EXPOSE 3001

CMD npm start
