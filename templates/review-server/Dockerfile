FROM docker:27.5.1-dind-alpine3.21
RUN apk add --no-cache nodejs npm && npm i express
COPY review-proxy.js /
