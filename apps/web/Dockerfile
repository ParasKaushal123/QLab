FROM python:3.11-slim AS build
WORKDIR /w
COPY . .
RUN python build.py
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /w/dist/ /usr/share/nginx/html/
EXPOSE 80
