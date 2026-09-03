# Tarefas — yt-resumo-worker

## Pré-requisitos

- [ ] 1. Configurar projeto Node.js (package.json, dependências)
- [ ] 2. Criar cliente Supabase
- [ ] 3. Criar cliente KPA Labs
- [ ] 4. Implementar função de resumo por categoria
- [ ] 5. Implementar função de notificação Telegram
- [ ] 6. Implementar loop principal (cron)
- [ ] 7. Configurar PM2 + cron
- [ ] 8. Testar localmente

---

## 1. Configurar projeto Node.js

**Dependências:**
- `@supabase/supabase-js` — cliente Supabase
- `node-cron` — agendamento
- `dotenv` — variáveis de ambiente
- `axios` — requests HTTP (KPA Labs)

**Arquivos:**
- `package.json`
- `.env.example`
- `src/index.js` — entry point

---

## 2. Criar cliente Supabase

**Responsabilidade:** Buscar vídeos pendentes e salvar resumos.

**Funções:**
- `buscarVideosPendentes()` → `Promise<Video[]>`
- `salvarResumo(videoId, resumo)` → `Promise<void>`

---

## 3. Criar cliente KPA Labs

**Responsabilidade:** Chamar Claude via proxy KPA.

**Funções:**
- `gerarResumo(transcricao, categoria)` → `Promise<string>`

**Modelo por categoria:**
| Categoria | Modelo | Quando |
|-----------|--------|--------|
| teologia | opus | Estudos bíblicos, parashá |
| estudo | opus | Conteúdo técnico profundo |
| marketing | sonnet | Conteúdo comercial, IA |
| outro | haiku | Rápido, geral |

---

## 4. Implementar função de resumo por categoria

**Prompt por categoria:**

**Teologia:**
```
Você é um estudioso da Torá. Resuma este estudo em formato estruturado:

## Resumo
(parágrafo)

## Pontos-chave
- ...

## Contexto Judaico
(...)

## Aplicação Prática
(...)
```

**Marketing:**
```
Resuma este conteúdo de forma direta e acionável:

## Resumo (3 linhas)

## Ideia Principal

## CTA/Próximo Passo
```

**Padrão:**
```
Resuma em 3-5 parágrafos:

[transcrição]
```

---

## 5. Implementar notificação Telegram

**Função:**
- `notificarTelegram(titulo, resumo, videoId)` → `Promise<void>`

**Formato da mensagem:**
```
🎬 *Novo resumo gerado*

{_titulo_}

{resumo_curto}

👆 Assistir: https://youtube.com/watch?v={videoId}
```

---

## 6. Loop principal (cron)

**Arquivo:** `src/worker.js`

**Fluxo:**
```
1. Log: "worker started"
2. Videos = await buscarVideosPendentes()
3. Log: "found N videos"
4. Para cada video:
   a. Log: "processing {titulo}"
   b. Resumo = await gerarResumo(video.transcricao, video.categoria)
   c. await salvarResumo(video.id, resumo)
   d. await notificarTelegram(video.titulo, resumo, video.youtube_id)
5. Log: "worker finished"
```

---

## 7. Configurar PM2 + cron

**Comandos:**
```bash
pm2 start src/index.js --name yt-resumo-worker
pm2 save
crontab -e
# 0 0 * * * pm2 restart yt-resumo-worker
# 0 12 * * * pm2 restart yt-resumo-worker
```

---

## 8. Testar localmente

**Teste manual:**
```bash
npm run worker  # roda uma vez
npm run worker:watch  # development
```

**Verificações:**
- [ ] Supabase conecta
- [ ] KPA Labs responde
- [ ] Telegram envia mensagem
- [ ] Status atualiza no banco
