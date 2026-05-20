FROM node:22-alpine

WORKDIR /app

# 安裝基礎依賴
RUN apk add --no-cache git

# 預先曝露 Angular 預設埠
EXPOSE 4200

# 啟動腳本：
# 1. 確保 package-lock 不會干擾大版本升級
# 2. 強制執行安裝
CMD ["sh", "-c", "rm -f package-lock.json && npm install --legacy-peer-deps && npm start -- --host 0.0.0.0 --poll 2000"]
