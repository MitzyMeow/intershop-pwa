FROM docker:27.2.1-dind-alpine3.20
RUN apk add --no-cache nodejs npm && npm i express
COPY review-proxy.js /
