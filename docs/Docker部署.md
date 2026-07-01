# ParentBond Linux 服务器 Docker 部署文档

本文按 Linux 服务器部署来写，目标是让你从一台空服务器开始，一步一步把 ParentBond 跑起来，并且以后可以很方便地更新代码到 Docker。

官方 Docker 安装步骤会随发行版更新，本文的安装命令参考 Docker 官方文档；如果你的服务器系统差异很大，优先以官方文档为准：

- Docker Ubuntu 安装文档：https://docs.docker.com/engine/install/ubuntu/
- Docker CentOS 安装文档：https://docs.docker.com/engine/install/centos/
- Docker Compose Linux 安装文档：https://docs.docker.com/compose/install/linux/

## 最快日常更新命令

首次部署完成后，平时不要每次都手动 `git pull` 再完整重建。直接在服务器项目目录执行：

```bash
cd /home/opt/parentbond
./scripts/docker-deploy.sh
```

这个脚本会自动：

- 拉取 GitHub 最新代码。
- 对比本次改了哪些文件。
- 只改文档或脚本时，不重建容器。
- 只改前端时，只重建 `web`。
- 只改后端时，只重建 `api`。
- 改了共享包、依赖、Dockerfile 或 compose 配置时，才重建相关服务。

日常更新不要加 `--no-cache`。`--no-cache` 会让 Docker 重新安装依赖和完整构建，只在缓存异常、浏览器仍显示旧代码时使用：

```bash
./scripts/docker-deploy.sh --no-cache
```

## 1. 部署后的结构

部署完成后，服务器上会有 3 个 Docker 服务：

```text
浏览器
  |
  | http://服务器IP:8080
  v
web 容器：Nginx + React 静态文件
  |-- /api/*      转发到 api:3000
  |-- /uploads/*  转发到 api:3000
  v
api 容器：NestJS 后端
  |
  v
mysql 容器：MySQL 8
```

默认只对外开放 `8080` 端口。MySQL 不暴露到公网，API 也不直接暴露，统一由 web 容器代理。

## 2. 你需要提前准备

- 一台 Linux 服务器，推荐 Ubuntu 22.04/24.04、Debian 12、CentOS Stream 9/10、Rocky Linux 9、AlmaLinux 9。
- 服务器可以访问互联网，用于拉取 Docker 镜像和安装包。
- 你能通过 SSH 登录服务器，并拥有 `sudo` 权限。
- 服务器安全组或防火墙允许访问 `8080/tcp`。
- 项目源码已经准备好，可以通过 Git、SCP、WinSCP、rsync 等方式上传到服务器。

下面示例里假设：

```text
服务器 IP：192.168.168.51
项目目录：/opt/parentbond
访问端口：8080
```

你部署时把 IP 换成自己的服务器 IP 或域名。

## 3. 登录服务器

从你的电脑登录 Linux 服务器：

```bash
ssh root@192.168.168.51
```

如果你用普通用户登录：

```bash
ssh your_user@192.168.168.51
```

后续命令里带 `sudo` 的地方需要输入服务器用户密码。

## 4. 安装 Docker 和 Docker Compose

先确认服务器系统：

```bash
cat /etc/os-release
```

### 4.1 Ubuntu / Debian 系服务器

Ubuntu 使用下面命令。Debian 也可以使用同样流程，但仓库地址里的 `ubuntu` 需要按 Docker 官方 Debian 文档改成 `debian`。

卸载可能冲突的旧包：

```bash
sudo apt-get remove -y docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc || true
```

安装 Docker 官方仓库依赖：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

添加 Docker apt 源：

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

安装 Docker Engine、Buildx 和 Compose 插件：

```bash
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

启动 Docker：

```bash
sudo systemctl enable --now docker
```

验证安装：

```bash
sudo docker run hello-world
sudo docker compose version
```

### 4.2 CentOS / Rocky / Alma 系服务器

安装 Docker 仓库工具：

```bash
sudo dnf -y install dnf-plugins-core
```

添加 Docker rpm 源：

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

安装 Docker Engine、Buildx 和 Compose 插件：

```bash
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

启动 Docker：

```bash
sudo systemctl enable --now docker
```

验证安装：

```bash
sudo docker run hello-world
sudo docker compose version
```

### 4.3 让当前用户不用每次 sudo

如果你不是 root 用户，建议把当前用户加入 `docker` 用户组：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

再验证一次：

```bash
docker ps
docker compose version
```

如果仍然提示无权限，退出 SSH 重新登录后再试。

## 5. 上传项目源码到服务器

推荐把项目放在 `/opt/parentbond`。

创建目录：

```bash
sudo mkdir -p /opt/parentbond
sudo chown -R $USER:$USER /opt/parentbond
```

### 方式 A：用 Git 拉取

如果项目已经在 Git 仓库里：

```bash
git clone <你的Git仓库地址> /opt/parentbond
cd /opt/parentbond
```

以后更新代码就是：

```bash
cd /opt/parentbond
git pull
```

### 方式 B：用 rsync 上传

在你的本地电脑项目目录执行：

```bash
rsync -av \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  --exclude apps/api/uploads \
  ./ your_user@192.168.168.51:/opt/parentbond/
```

### 方式 C：用 WinSCP 上传

如果你从 Windows 上传：

1. 打开 WinSCP。
2. 连接服务器：`192.168.168.51`。
3. 进入服务器目录：`/opt/parentbond`。
4. 上传项目文件。
5. 不需要上传 `node_modules`、`apps/web/dist`、`apps/api/dist`、本地 `.env`、日志文件。

上传完成后，在服务器执行：

```bash
cd /opt/parentbond
ls
```

应能看到：

```text
apps
packages
docker-compose.yml
Dockerfile.api
Dockerfile.web
scripts
.env.docker.example
```

## 6. 配置生产环境变量

进入项目目录：

```bash
cd /opt/parentbond
```

复制环境变量模板：

```bash
cp .env.docker.example .env
```

编辑 `.env`：

```bash
nano .env
```

至少修改这些值：

```env
TZ=Asia/Shanghai
WEB_PORT=8080

MYSQL_ROOT_PASSWORD=请改成强密码
MYSQL_DATABASE=parentbond
MYSQL_USER=parentbond
MYSQL_PASSWORD=请改成强密码

VITE_API_BASE_URL=http://192.168.168.51:8080/api/v1
WEB_ORIGIN=http://192.168.168.51:8080
```

如果你使用域名，例如 `http://parentbond.example.com:8080`：

```env
VITE_API_BASE_URL=http://parentbond.example.com:8080/api/v1
WEB_ORIGIN=http://parentbond.example.com:8080
```

如果你后面配置 HTTPS，例如 `https://parentbond.example.com`：

```env
VITE_API_BASE_URL=https://parentbond.example.com/api/v1
WEB_ORIGIN=https://parentbond.example.com
```

AI Key 可以先不填。不填时，作业解析接口会走本地 fallback，不影响系统启动。

编辑完成后保存：

- `nano` 保存：按 `Ctrl + O`，回车。
- 退出：按 `Ctrl + X`。

检查 `.env` 是否存在：

```bash
ls -la .env
```

## 7. 打开服务器端口

如果服务器有云厂商安全组，需要在云控制台放行：

```text
入方向 TCP 8080
来源 0.0.0.0/0
```

如果服务器启用了 Ubuntu UFW：

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

如果服务器启用了 firewalld：

```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

## 8. 首次启动项目

给 Linux 更新脚本执行权限：

```bash
cd /opt/parentbond
chmod +x scripts/docker-update.sh
```

首次构建并启动：

```bash
./scripts/docker-update.sh
```

首次执行会做这些事情：

- 构建 `api` 镜像。
- 构建 `web` 镜像。
- 启动 `mysql`、`api`、`web` 容器。
- 第一次创建 MySQL volume 时自动导入 `apps/api/src/database/schema.sql`。
- 等待 API 健康检查通过。
- 显示容器状态。

第一次构建可能需要几分钟。如果服务器网络慢，等待即可。

如果提示 Docker 权限不足，使用：

```bash
sudo ./scripts/docker-update.sh
```

或者按第 4.3 节把当前用户加入 `docker` 用户组后重新登录。

## 9. 验证部署结果

查看容器状态：

```bash
docker compose ps
```

你应该看到 `mysql`、`api`、`web` 都处于 running 或 healthy。

在服务器本机验证 API：

```bash
curl -i http://127.0.0.1:8080/api/v1/health
```

正常会看到类似内容：

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "service": "parentbond-api"
  },
  "message": "ok"
}
```

验证首页：

```bash
curl -I http://127.0.0.1:8080/
```

从浏览器访问：

```text
http://192.168.168.51:8080
```

如果浏览器打不开，按顺序检查：

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f api
sudo ss -lntp | grep 8080
```

同时确认云服务器安全组和 Linux 防火墙都放行了 `8080/tcp`。

## 10. 日常更新代码到 Docker

### 10.1 如果你用 Git 管理代码

进入项目目录：

```bash
cd /opt/parentbond
```

拉取最新代码：

```bash
git pull
```

一条命令更新 Docker：

```bash
./scripts/docker-update.sh
```

这个脚本会重建镜像、替换容器，并保留数据库和上传文件 volume。

### 10.2 如果你手动上传覆盖代码

先用 WinSCP、rsync 或 SCP 覆盖服务器上的项目文件。

然后在服务器执行：

```bash
cd /opt/parentbond
./scripts/docker-update.sh
```

### 10.3 只更新前端

如果只修改了 `apps/web`、前端样式、前端页面：

```bash
./scripts/docker-update.sh --service web
```

### 10.4 只更新后端

如果只修改了 `apps/api`、数据库实体、接口逻辑：

```bash
./scripts/docker-update.sh --service api
```

### 10.5 不使用 Docker 缓存重建

如果发现代码更新后页面还是旧的：

```bash
./scripts/docker-update.sh --no-cache
```

只对前端禁用缓存：

```bash
./scripts/docker-update.sh --service web --no-cache
```

### 10.6 更新基础镜像

需要顺便拉取新的 Node/Nginx/MySQL 基础镜像时：

```bash
./scripts/docker-update.sh --pull
```

日常更新不要执行：

```bash
docker compose down -v
```

`-v` 会删除 MySQL 数据 volume 和上传文件 volume，生产环境不要随手使用。

## 11. 查看日志和排查问题

查看全部日志：

```bash
docker compose logs -f
```

只看 API：

```bash
docker compose logs -f api
```

只看 Web/Nginx：

```bash
docker compose logs -f web
```

只看 MySQL：

```bash
docker compose logs -f mysql
```

查看最近 200 行：

```bash
docker compose logs --tail=200 api web
```

重启服务：

```bash
docker compose restart
```

只重启 API：

```bash
docker compose restart api
```

进入 API 容器：

```bash
docker compose exec api sh
```

进入 MySQL：

```bash
docker compose exec mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
```

## 12. 数据库初始化和表结构

首次启动时，MySQL 容器会自动执行：

```text
apps/api/src/database/schema.sql
```

注意：MySQL 只会在 `mysql-data` volume 第一次创建时执行初始化 SQL。后续你修改 `schema.sql`，MySQL 不会自动重新执行。

如果是生产环境需要新增字段或修改表结构，建议写单独的 SQL，并手动执行：

```bash
docker compose exec -T mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < your-migration.sql
```

如果只是测试环境，确认数据可以删除，才可以全新初始化：

```bash
docker compose down -v
./scripts/docker-update.sh
```

生产环境不要执行 `docker compose down -v`。

## 13. 数据备份和恢复

创建备份目录：

```bash
cd /opt/parentbond
mkdir -p backups
```

备份 MySQL：

```bash
docker compose exec -T mysql sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > "backups/parentbond-$(date +%F-%H%M%S).sql"
```

备份上传文件 volume：

```bash
docker run --rm \
  -v parentbond_api-uploads:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cd /data && tar czf "/backup/uploads-$(date +%F-%H%M%S).tar.gz" .'
```

恢复 MySQL：

```bash
cat backups/parentbond-你的备份文件.sql | docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

恢复上传文件：

```bash
docker run --rm \
  -v parentbond_api-uploads:/data \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cd /data && tar xzf /backup/uploads-你的备份文件.tar.gz'
```

建议上线后至少每天备份一次数据库。

## 14. 使用域名和 HTTPS

如果你有域名，建议让 Docker 继续监听本机 `8080`，然后用服务器外层 Nginx 做 HTTPS。

`.env` 推荐这样写：

```env
WEB_PORT=127.0.0.1:8080
VITE_API_BASE_URL=https://parentbond.example.com/api/v1
WEB_ORIGIN=https://parentbond.example.com
```

更新前端镜像：

```bash
./scripts/docker-update.sh --service web --no-cache
```

安装 Nginx：

```bash
sudo apt-get install -y nginx
```

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/parentbond.conf
```

写入：

```nginx
server {
    listen 80;
    server_name parentbond.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/parentbond.conf /etc/nginx/sites-enabled/parentbond.conf
sudo nginx -t
sudo systemctl reload nginx
```

如果使用 Certbot 申请 HTTPS：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d parentbond.example.com
```

申请成功后访问：

```text
https://parentbond.example.com
```

## 15. 常见问题

### 15.1 docker compose 命令不存在

确认安装的是 Compose v2 插件：

```bash
docker compose version
```

如果只有 `docker-compose`，说明是旧版 Compose。建议按第 4 节安装 Docker 官方 Compose 插件。

### 15.2 端口 8080 被占用

查看占用：

```bash
sudo ss -lntp | grep 8080
```

改 `.env`：

```env
WEB_PORT=8090
VITE_API_BASE_URL=http://192.168.168.51:8090/api/v1
WEB_ORIGIN=http://192.168.168.51:8090
```

重新构建 web：

```bash
./scripts/docker-update.sh --service web --no-cache
```

### 15.3 前端打开了，但接口报错

检查 `.env`：

```bash
grep -E 'VITE_API_BASE_URL|WEB_ORIGIN|WEB_PORT' .env
```

推荐使用同域代理地址：

```env
VITE_API_BASE_URL=/api/v1
WEB_ORIGIN=http://你的服务器IP:8080
```

确认 `VITE_API_BASE_URL` 不要写成容器内部地址 `http://api:3000/api/v1`。如果浏览器 Network 里仍然看到 `http://localhost:8080/api/v1/...`，说明前端 web 镜像还是旧构建产物，需要重新构建 web 镜像。

修改后重新构建前端：

```bash
./scripts/docker-update.sh --service web --no-cache
```

### 15.4 API 连不上 MySQL

查看日志：

```bash
docker compose logs -f api
docker compose logs -f mysql
```

如果你启动过一次后又修改了 `MYSQL_USER` 或 `MYSQL_PASSWORD`，旧的 MySQL volume 不会自动改用户密码。生产环境应进入 MySQL 手动改密码；测试环境确认数据可删后，可以 `docker compose down -v` 重新初始化。

### 15.5 表不存在

检查 MySQL 初始化日志：

```bash
docker compose logs mysql | grep -i schema
```

也可以进入 MySQL 查看表：

```bash
docker compose exec mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES;"
```

如果 volume 已经存在，`schema.sql` 不会再次自动执行，需要手动导入或重新初始化测试数据。

### 15.6 上传的图片或视频打不开

检查上传目录：

```bash
docker compose exec api ls -R /app/apps/api/uploads
```

检查 `/uploads/` 代理：

```bash
curl -I http://127.0.0.1:8080/uploads/
```

如果你改过 Nginx 或域名代理，确认 `/uploads/` 没有被外层 Nginx 拦截。

## 16. 最短命令清单

服务器已经装好 Docker 后，最常用的部署命令就是：

```bash
cd /opt/parentbond
cp .env.docker.example .env
nano .env
chmod +x scripts/docker-update.sh
./scripts/docker-update.sh
curl -i http://127.0.0.1:8080/api/v1/health
```

以后每次更新：

```bash
cd /opt/parentbond
git pull
./scripts/docker-update.sh
```
