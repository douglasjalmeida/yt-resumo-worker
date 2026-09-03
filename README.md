# yt-resumo-worker

Worker que resume vídeos do YouTube automaticamente via cron (2x/dia: 00:00 e 12:00).

## Setup

```bash
# 1. Clonar/instalar
cd yt-resumo-worker
npm install

# 2. Configurar variáveis
cp .env.example .env
# Editar .env com suas credenciais

# 3. Testar localmente
npm run worker
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_PAT` | Personal Access Token do Supabase |
| `KPA_LABS_API_KEY` | API Key do KPA Labs |
| `KPA_LABS_URL` | URL da API KPA Labs (opcional) |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `TELEGRAM_CHAT_ID` | Chat ID para notificações |

## Deploy na VPS (EasyPanel)

```bash
# 1. Build no EasyPanel
# - Build command: npm install && npm run build
# - Start command: npm start

# 2. Ou com PM2 diretamente
pm2 start src/index.js --name yt-resumo-worker
pm2 save

# 3. Agendar restart via cron do sistema
crontab -e
# 0 0 * * * cd /path/to/yt-resumo-worker && pm2 restart yt-resumo-worker
# 0 12 * * * cd /path/to/yt-resumo-worker && pm2 restart yt-resumo-worker
```

## Estrutura

```
yt-resumo-worker/
├── src/
│   ├── index.js      # Entry point
│   ├── worker.js     # Lógica principal
│   ├── supabase.js   # Cliente Supabase
│   ├── kpa-labs.js   # Cliente KPA Labs
│   └── telegram.js   # Cliente Telegram
├── package.json
├── .env.example
└── SPEC.md
```

## Modelos Claude

| Categoria | Modelo | Use case |
|-----------|--------|----------|
| teologia | opus | Estudos bíblicos |
| estudo | opus | Conteúdo técnico |
| marketing | sonnet | Conteúdo comercial |
| outro | haiku | Geral (rápido) |
