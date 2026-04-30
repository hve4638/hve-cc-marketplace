FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git tini xvfb \
      chromium fonts-liberation fonts-noto-cjk fonts-noto-color-emoji \
      procps lsof x11vnc novnc websockify && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm i -g openclaw@latest

COPY entrypoint.sh /usr/local/bin/oc-entry
RUN chmod +x /usr/local/bin/oc-entry

RUN userdel -r node 2>/dev/null || true && \
    useradd -m -u 1000 oc && \
    mkdir -p /home/oc/.openclaw /home/oc/shared && \
    chown -R oc:oc /home/oc

USER oc
WORKDIR /home/oc

ENV HOME=/home/oc \
    DISPLAY=:99

EXPOSE 6080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/oc-entry"]
