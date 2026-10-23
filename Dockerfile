FROM node:22.23.4

ADD . /app
WORKDIR /app

RUN apt-get update
RUN apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

RUN yarn install

CMD ["yarn", "start"]
