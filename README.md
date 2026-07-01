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
chmod +x scripts/docker-update.sh
./scripts/docker-update.sh
```

Windows local:

```powershell
Copy-Item .env.docker.example .env
.\scripts\docker-update.ps1
```

Open `http://localhost:8080` after the containers are healthy.

Daily updates on Linux:

```bash
./scripts/docker-update.sh
./scripts/docker-update.sh --service web
./scripts/docker-update.sh --service api
```

Daily updates through npm when Node.js is available:

```powershell
npm run docker:update
npm run docker:update:web
npm run docker:update:api
```
