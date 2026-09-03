# yt-resumo-worker

Worker que resume vídeos do YouTube automaticamente (**on-demand**).

A cada 60 segundos, checa o Supabase. Se tiver vídeo com `status='transcrito'` e `resumo_md IS NULL`, gera o resumo imediatamente com Opus 5 (KPA Labs) e notifica no WhatsApp via douglas-ia.

## Setup

```bash
# 1. Instalar
cd yt-resumo-worker
npm install

# 2. Configurar variáveis
cp .env.example .env
# Editar .env com suas credenciais

# 3. Rodar
npm start
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_PAT` | Personal Access Token do Supabase (ou use `SUPABASE_SERVICE_ROLE_KEY` do douglas-ia) |
| `ANTHROPIC_BASE_URL` | URL do proxy Claude (KPA Labs) — ex: `https://api.kpalabz.com` |
| `ANTHROPIC_API_KEY` | API Key do KPA Labs |
| `DOUGLAS_IA_WEBHOOK_URL` | URL do webhook de notificação (douglas-ia) |

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

## Modelo Claude

**Padrão: Opus 5** — usado em todas as categorias.

O worker roda apenas 2x/dia (00:00 e 12:00), então o custo extra do Opus em comparação com Haiku/Sonnet é aceitável pela qualidade superior dos resumos.
