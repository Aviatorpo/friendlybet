# FriendlyBet — a static, no-build PWA served by nginx.
# Before building, set your Supabase URL + public anon key in config.js
# (or bind-mount your own config.js over /usr/share/nginx/html/config.js at runtime).
#
#   docker build -t friendlybet .
#   docker run -p 8080:80 friendlybet
#   # then open http://localhost:8080
#
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
