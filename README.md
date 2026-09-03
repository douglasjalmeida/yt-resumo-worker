# yt-resumo-worker

Worker que resume vídeos do YouTube automaticamente (**on-demand**).

A cada 60 segundos, checa o Supabase. Se tiver vídeo com `status='transcrito'` e `resumo_md IS NULL`, gera o resumo imediatamente com **Opus 5** (KPA Labs) e notifica no WhatsApp via **douglas-ia**.

---

## Arquitetura

```
┌──────────────────┐
│  YouTube         │
│  (playlist)      │
└────────┬─────────┘
         ↓ polling 30min
┌──────────────────┐
│  douglas-conteudo│  (engine de ingestão + transcrição Groq)
│  (VPS)           │
└────────┬─────────┘
         ↓ salva transcricao_texto
┌──────────────────┐
│  Supabase        │  (tabela: douglas_conteudo_videos)
│  status=         │
│  'transcrito'    │
└────────┬─────────┘
         ↓ loop 60s (on-demand)
┌──────────────────┐
│  yt-resumo-worker│  ← ESTE REPO (VPS, EasyPanel)
│  (este worker)   │
└────────┬─────────┘
         ↓ KPA Labs (Opus 5)
┌──────────────────┐
│  Supabase        │  (resumo_md preenchido, status='concluido')
└────────┬─────────┘
         ↓ webhook POST /notificar-resumo
┌──────────────────┐
│  douglas-ia      │  (envia via uazapi → WhatsApp)
│  (Fly.io)        │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  WhatsApp do     │  📱 "🎬 Novo resumo gerado!"
│  Douglas         │
└──────────────────┘
```

---

## Setup Local

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

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|:-----------:|
| `SUPABASE_URL` | URL do projeto Supabase | ✅ |
| `SUPABASE_PAT` | Personal Access Token do Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Alternativa ao `SUPABASE_PAT` (use se já tiver do douglas-ia) | ⚠️ |
| `ANTHROPIC_BASE_URL` | URL do proxy Claude (KPA Labs) — ex: `https://api.kpalabz.com` | ✅ |
| `ANTHROPIC_API_KEY` | API Key do KPA Labs | ✅ |
| `DOUGLAS_IA_WEBHOOK_URL` | URL do webhook de notificação. Default: `https://douglas-ia.fly.dev/notificar-resumo` | ❌ |

> **Dica:** Pode copiar as variáveis do `.env` do `douglas-ia` — usa o mesmo padrão (`ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`).

---

## Deploy na VPS (EasyPanel)

### 1. Criar app no EasyPanel
- **Name:** `yt-resumo-worker`
- **Repository:** `douglasjalmeida/yt-resumo-worker`
- **Build:** Nixpacks (automático)
- **Start Command:** `npm start`

### 2. Configurar Environment Variables

No painel do EasyPanel → Environment Variables, adicione:

```
SUPABASE_URL=https://ddtiqcrmhirmxmcjfsxj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...                    # do douglas-ia
ANTHROPIC_BASE_URL=https://api.kpalabz.com
ANTHROPIC_API_KEY=sk-kpa-...                        # do douglas-ia
```

> O `DOUGLAS_IA_WEBHOOK_URL` tem default, não precisa adicionar.

### 3. Deploy
- Clique em **"Implantar"**
- O worker vai rodar em **loop contínuo** (a cada 60s)

---

## Como Funciona (Loop On-Demand)

```javascript
// src/index.js
setInterval(async () => {
  await executarWorker({ silencioso: true });
}, 60 * 1000);  // a cada 60 segundos
```

A cada 60 segundos:
1. **Busca** vídeos com `status='transcrito' AND resumo_md IS NULL` no Supabase
2. **Para cada vídeo** (limite: 10 por ciclo):
   - Gera resumo com Opus 5 (via KPA Labs)
   - Salva `resumo_md` + muda `status` para `'concluido'`
3. **Notifica** o Douglas via WhatsApp (chama o webhook do douglas-ia)

**Latência típica:** até 60 segundos entre a transcrição e o WhatsApp.

---

## Modelo Claude

**Padrão: Opus 5** — usado em todas as categorias.

Como o worker roda **24/7 on-demand**, o custo de Opus é aceitável. Se tiver muitos vídeos em fila, considerar:
- Trocar para `claude-sonnet-5` (mais barato, qualidade ainda boa)
- Adicionar variável `LLM_MODEL` e ajustar `kpa-labs.js`

---

## Estrutura

```
yt-resumo-worker/
├── src/
│   ├── index.js       # Entry point + loop on-demand
│   ├── worker.js      # Lógica principal (busca, resume, salva, notifica)
│   ├── supabase.js    # Cliente Supabase
│   ├── kpa-labs.js    # Cliente KPA Labs (Anthropic API proxy)
│   └── notificador.js # Webhook para douglas-ia
├── package.json
├── .env.example
├── README.md
├── SPEC.md
└── TASKS.md
```

---

## Troubleshooting

### Worker não processa
1. Verifique se o vídeo está com `status='transcrito'`
2. Verifique se `resumo_md` está NULL
3. Veja os logs no EasyPanel

### Notificação não chega
1. Verifique se o endpoint do douglas-ia está respondendo:
   ```bash
   curl -X POST https://douglas-ia.fly.dev/notificar-resumo \
     -H "Content-Type: application/json" \
     -d '{"titulo":"teste","resumo":"teste","youtubeId":"teste"}'
   ```
2. Confirme que o douglas-ia tem as envs:
   - `USUARIO_WHATSAPP_NUMBER`
   - `UAZAPI_BASE_URL`
   - `UAZAPI_INSTANCE_TOKEN`

### Resumo vazio
1. Verifique se a KPA Labs está respondendo
2. O Opus 5 às vezes gasta tokens no "thinking" — o fix já desabilitou isso
3. Veja os logs no EasyPanel para detalhes

---

## Changelog

### 2026-09-03 — On-Demand + Opus 5
- Migração de cron fixo (00:00/12:00) para **loop on-demand** (60s)
- Migração de **Haiku/Sonnet/Opus por categoria** → **Opus 5 em tudo**
- Migração de **Telegram** → **WhatsApp via douglas-ia**
- Adicionado endpoint `POST /notificar-resumo` no douglas-ia
- Suporte a `SUPABASE_SERVICE_ROLE_KEY` (compatibilidade com douglas-ia)
- Fix: desabilitar thinking mode do Opus (evita resposta vazia)

---

## Repositórios Relacionados

- **douglas-ia** (notificador WhatsApp): https://github.com/douglasjalmeida/douglas-ia
- **douglas-conteudo** (engine de ingestão): https://github.com/douglasjalmeida/douglas-conteudo
