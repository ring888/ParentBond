# ParentBond

React Web/PWA first version for the ParentBond family companionship product.

## Documentation

- [项目说明](docs/项目说明.md)
- [Linux 服务器 Docker 部署文档](docs/Docker部署.md)

## Stack

- Web: React + Vite + PWA manifest
- API: NestJS-style modular backend
- Database: MySQL 8
- AI providers: Xiaomi MiMo, OpenAI, Claude, DeepSeek through provider adapters

## Local start

```powershell
npm install
npm run dev:web
npm run dev:api
```

Copy `apps/api/.env.example` to `apps/api/.env` before starting the API.

## Docker start

Linux server:

```bash
cp .env.docker.example .env
nano .env
chmod +x scripts/docker-update.sh scripts/docker-deploy.sh
./scripts/docker-update.sh
```

Windows local:

```powershell
Copy-Item .env.docker.example .env
.\scripts\docker-update.ps1
```

Open `http://localhost:8080` after the containers are healthy.

## Fast Linux updates

After the first deployment, use the fast deploy script:

```bash
cd /home/opt/parentbond
./scripts/docker-deploy.sh
```

It pulls the latest GitHub code, detects changed files, and rebuilds only the affected service:

- docs/scripts only: no container rebuild
- frontend only: rebuild `web`
- backend only: rebuild `api`
- shared/package/compose changes: rebuild both

Avoid `--no-cache` for daily updates. Use it only when the browser still shows old bundled code:

```bash
./scripts/docker-deploy.sh --no-cache
```
