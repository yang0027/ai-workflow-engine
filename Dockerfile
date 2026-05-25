# ==========================================
# Stage 1: Build the Canvas React App
# ==========================================
FROM node:20-alpine AS canvas-builder
WORKDIR /app/canvas
COPY canvas/package*.json ./
RUN npm ci
COPY canvas/ ./
RUN npm run build

# ==========================================
# Stage 2: Set up the Gateway microservice
# ==========================================
FROM node:20-alpine AS gateway-builder
WORKDIR /app/gateway
COPY gateway/package*.json ./
RUN npm ci
COPY gateway/ ./
RUN npm run build

# ==========================================
# Stage 3: Set up the Engine microservice
# ==========================================
FROM node:20-alpine AS engine-builder
WORKDIR /app/engine
COPY engine/package*.json ./
RUN npm ci
COPY engine/ ./
RUN npm run build

# ==========================================
# Stage 4: Production Runner (Exposes ports)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# 安装静态资源服务器以托管编译后的 Canvas 网页成果，并使用 PM2 管理三个服务的运行
RUN npm install -g sirv-cli pm2

# 复制网关、引擎微服务代码及编译产物
COPY --from=gateway-builder /app/gateway /app/gateway
COPY --from=engine-builder /app/engine /app/engine
# 复制已编译好的 Canvas 静态静态网页文件
COPY --from=canvas-builder /app/canvas/dist /app/canvas/dist

# 开放端口
# Canvas: 5173
# Gateway: 3000
# Engine: 4000
EXPOSE 5173 3000 4000

# 拷贝 PM2 多服务守护启动配置文件
COPY ecosystem.config.cjs /app/ecosystem.config.cjs

# 启动 PM2 守护进程
CMD ["pm2-runtime", "/app/ecosystem.config.cjs"]
