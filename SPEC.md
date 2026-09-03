# yt-resumo-worker — Especificação

## Contexto

Douglas tem um pipeline de YouTube onde:
1. Vídeos são baixados automaticamente
2. Transcrições são geradas via Groq
3. Salvas no Supabase (tabela `douglas_conteudo_videos`)

**Problema:** Os resumos ainda são feitos manualmente.

**Solução:** Worker Node.js que roda automaticamente 2x/dia, gerando resumos para vídeos que:
- Têm transcrição pronta (`status = transcrito`)
- Ainda não têm resumo (`resumo IS NULL`)

---

## Funcionalidades

### Core

1. **Busca fila do Supabase**
   - Filtra: `status = 'transcrito' AND resumo IS NULL`
   - Ordena: `created_at ASC` (mais antigos primeiro)

2. **Gera resumo via KPA Labs (Claude)**
   - Usa Haiku para conteúdo rápido (IA, marketing)
   - Usa Sonnet para conteúdo complexo (teologia, estudos)
   - Usa Opus para teologia judaica (mais profundidade)

3. **Salva resumo no Supabase**
   - Atualiza campo `resumo` da tabela
   - Marca `status = 'concluido'`

4. **Notifica via WhatsApp (via douglas-ia)**
   - Webhook no douglas-ia (`/notificar-resumo`)
   - douglas-ia envia via uazapi pro WhatsApp do Douglas
   - Mensagem com título do vídeo + link

### Schedule

| Horário | Objetivo |
|---------|----------|
| 00:00 | Resumir vídeos do dia anterior |
| 12:00 | Resumir vídeos da manhã |

---

## Tech Stack

- **Runtime:** Node.js 18+
- **LLM:** KPA Labs API (proxy Claude)
- **Banco:** Supabase (PostgreSQL)
- **Cron:** node-cron
- **Deploy:** VPS + PM2 (EasyPanel)

---

## Variáveis de Ambiente

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PAT=sb-pat-xxx
KPA_LABS_API_KEY=sk-kpa-xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
```

## Notificação

A notificação é feita via webhook para o douglas-ia (`POST /notificar-resumo`), que envia a mensagem via WhatsApp usando a uazapi já configurada no douglas-ia.

---

## Modelo de Dados

### Tabela: `douglas_conteudo_videos`

```sql
id              UUID PRIMARY KEY
youtube_id      TEXT
titulo          TEXT
categoria       TEXT  -- 'teologia' | 'marketing' | 'estudo' | 'outro'
status          TEXT  -- 'transcrito' | 'concluido' | 'erro'
transcricao     TEXT
resumo          TEXT
erro            TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

---

## Fluxo Principal

```
┌──────────────┐
│ 1. Cron触发   │
└──────┬───────┘
       ▼
┌──────────────┐
│ 2. Query      │
│ Supabase      │
└──────┬───────┘
       ▼
┌──────────────┐     ┌──────────────┐
│ 3. Para cada │────▶│ 4. Gera     │
│ vídeo        │     │ resumo KPA   │
└──────┬───────┘     └──────┬───────┘
       │                      │
       ▼                      ▼
┌──────────────┐     ┌──────────────┐
│ 5. Salva     │◀────│ 6. Success? │
│ no Supabase  │     └──────────────┘
└──────┬───────┘
       ▼
┌──────────────┐
│ 7. Notifica  │
│ Telegram      │
└──────────────┘
```

---

## Tratamento de Erros

- **Erro na LLM:** Marca `status = 'erro'`, salva mensagem em `erro`
- **Erro no Supabase:** Log e continua para próximo vídeo
- **Vídeo sem transcrição:** Pula silenciosamente
- **Rate limit KPA:** Retry com backoff

---

## Logging

```
[2026-09-03 00:00:01] INFO: yt-resumo-worker started
[2026-09-03 00:00:02] INFO: Found 3 videos to process
[2026-09-03 00:00:03] INFO: Processing: ABC123 - "Título do Vídeo"
[2026-09-03 00:00:15] INFO: Summary generated (Haiku, 120 tokens)
[2026-09-03 00:00:16] INFO: Saved to Supabase
[2026-09-03 00:00:17] INFO: Telegram notification sent
[2026-09-03 00:00:20] INFO: yt-resumo-worker finished (3 processed, 0 errors)
```

---

## Critérios de Sucesso

1. Worker roda sem erro às 00:00 e 12:00
2. Resumos são gerados para vídeos transcritos
3. Telegram recebe notificação por vídeo
4. Status no banco é atualizado corretamente
5. Erros são tratados sem quebrar o worker

---

## Fora do Escopo (v1)

- Retry de vídeos que falharam
- Interface web/admin
- Histórico de execuções
- Limite de vídeos por execução
