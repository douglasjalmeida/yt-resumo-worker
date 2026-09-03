/**
 * Worker principal
 * Busca vídeos pendentes, gera resumos, salva no banco, notifica Telegram
 */

import cron from 'node-cron';
import { criarClienteSupabase } from './supabase.js';
import { criarClienteKPA } from './kpa-labs.js';
import { criarNotificador } from './notificador.js';

// ============================================================
// LOG
// ============================================================

function log(tipo, mensagem) {
  const agora = new Date().toISOString();
  console.log(`[${agora}] ${tipo}: ${mensagem}`);
}

const INFO = (msg) => log('INFO', msg);
const WARN = (msg) => log('WARN', msg);
const ERROR = (msg) => log('ERROR', msg);

// ============================================================
// PROMPT POR CATEGORIA
// ============================================================

const PROMPTS_POR_CATEGORIA = {
  teologia: `Você é um estudioso da Torá com conhecimento profundo do contexto judaico-messiânico.

Resuma este estudo bíblico em formato estruturado:

## Resumo
(parágrafo conciso)

## Pontos-Chave
- ponto 1
- ponto 2
- ponto 3

## Contexto Judaico
(explicação do contexto cultural/histórico)

## Aplicação Prática
(como aplicar esta verdade na vida)

## Glossário Hebraico (se aplicável)
termo: significado

Transcrição:
{transcricao}`,

  estudo: `Resuma este conteúdo de estudo de forma clara e organizada:

## Resumo
(parágrafo introdutório)

## Conceitos Principais
1. ...
2. ...
3. ...

## Insights Relevantes
- ...

## Perguntas para Reflexão
- ...

Transcrição:
{transcricao}`,

  marketing: `Resuma este conteúdo de forma direta e acionável:

## Resumo (3 linhas)
...

## Ideia Principal
...

## Ponto de Ação
O que fazer com isso?

Transcrição:
{transcricao}`,

  // Padrão para 'outro' ou indefinido
  default: `Resuma o seguinte conteúdo de forma clara e concisa (3-5 parágrafos):

Transcrição:
{transcricao}`,
};

// ============================================================
// WORKER
// ============================================================

export async function executarWorker() {
  const supabase = criarClienteSupabase();
  const kpa = criarClienteKPA();
  const telegram = criarNotificador();

  let processados = 0;
  let erros = 0;

  try {
    INFO('Worker iniciado');

    // 1. Buscar vídeos pendentes
    const { data: videos, error: erroBusca } = await supabase
      .from('douglas_conteudo_videos')
      .select('video_id, titulo, categoria, transcricao_texto, transcricao_segmentos')
      .eq('status', 'transcrito')
      .is('resumo_md', null)
      .order('data_adicao_playlist', { ascending: true })
      .limit(10);

    if (erroBusca) {
      ERROR(`Erro ao buscar vídeos: ${erroBusca.message}`);
      return { processados: 0, erros: 1 };
    }

    if (!videos || videos.length === 0) {
      INFO('Nenhum vídeo pendente');
      return { processados: 0, erros: 0 };
    }

    INFO(`Encontrados ${videos.length} vídeos para processar`);

    // 2. Processar cada vídeo
    for (const video of videos) {
      try {
        INFO(`Processando: ${video.titulo}`);

        // Selecionar prompt baseado na categoria
        const categoria = (video.categoria || 'Marketing/Conteúdo').toLowerCase().replace(/[áàãâ]/g, 'a');
        let promptTemplate = PROMPTS_POR_CATEGORIA[categoria] || PROMPTS_POR_CATEGORIA.default;

        // Substituir placeholder
        promptTemplate = promptTemplate.replace('{transcricao}', video.transcricao_texto);

        // Gerar resumo
        const { texto: resumo, modelo } = await kpa.gerarResumo({
          prompt: promptTemplate,
          categoria,
        });

        INFO(`Resumo gerado (${modelo})`);

        // Salvar no banco
        const { error: erroUpdate } = await supabase
          .from('douglas_conteudo_videos')
          .update({
            resumo_md: resumo,
            status: 'concluido',
            updated_at: new Date().toISOString(),
          })
          .eq('video_id', video.video_id);

        if (erroUpdate) {
          throw new Error(`Erro ao salvar: ${erroUpdate.message}`);
        }

        INFO(`Salvo no Supabase`);

        // Notificar Telegram
        const resumoCurto = resumo.split('\n')[0].substring(0, 200);
        await telegram.enviarMensagem({
          titulo: video.titulo,
          resumo: resumoCurto,
          youtubeId: video.video_id,
        });

        INFO(`Notificação enviada`);

        processados++;
      } catch (err) {
        ERROR(`Erro ao processar ${video.titulo}: ${err.message}`);

        // Marcar como erro no banco
        await supabase
          .from('douglas_conteudo_videos')
          .update({
            status: 'erro',
            erro: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq('video_id', video.video_id);

        erros++;
      }
    }

    INFO(`Worker finalizado: ${processados} processados, ${erros} erros`);
    return { processados, erros };
  } catch (err) {
    ERROR(`Erro fatal no worker: ${err.message}`);
    return { processados, erros: erros + 1 };
  }
}

// ============================================================
// SCHEDULE — Agendar execução
// ============================================================

export function iniciarSchedule() {
  // 00:00 — Resumir vídeos do dia
  cron.schedule('0 0 * * *', () => {
    INFO('Cron: executando worker (meia-noite)');
    executarWorker();
  });

  // 12:00 — Resumir vídeos da manhã
  cron.schedule('0 12 * * *', () => {
    INFO('Cron: executando worker (meio-dia)');
    executarWorker();
  });

  INFO('Schedule iniciado: 00:00 e 12:00');
}
