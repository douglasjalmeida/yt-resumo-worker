/**
 * Worker principal
 * Busca vídeos pendentes, gera resumos, salva no banco, notifica WhatsApp
 */

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

export async function executarWorker({ silencioso = false } = {}) {
  const supabase = criarClienteSupabase();
  const kpa = criarClienteKPA();
  const telegram = criarNotificador();

  let processados = 0;
  let erros = 0;

  const log = silencioso
    ? () => {} // No-op
    : (tipo, msg) => {
        const agora = new Date().toISOString();
        console.log(`[${agora}] ${tipo}: ${msg}`);
      };
  const INFO = (msg) => log('INFO', msg);
  const WARN = (msg) => log('WARN', msg);
  const ERROR = (msg) => log('ERROR', msg);

  try {
    if (!silencioso) INFO('Worker iniciado');

    // 1. Buscar vídeos pendentes
    const { data: videos, error: erroBusca } = await supabase
      .from('douglas_conteudo_videos')
      // Só colunas leves: a transcrição (~38 kB/vídeo) é baixada 1 por vez, ao processar.
      .select('video_id, titulo, categoria')
      .eq('status', 'transcrito')
      .is('resumo_md', null)
      .order('data_adicao_playlist', { ascending: true })
      .limit(10);

    if (erroBusca) {
      ERROR(`Erro ao buscar vídeos: ${erroBusca.message}`);
      return { processados: 0, erros: 1, pendentes: 0 };
    }

    if (!videos || videos.length === 0) {
      if (!silencioso) INFO('Nenhum vídeo pendente');
      return { processados: 0, erros: 0, pendentes: 0 };
    }

    const pendentes = videos.length;

    if (!silencioso) INFO(`Encontrados ${videos.length} vídeos para processar`);

    // 2. Processar cada vídeo
    for (const video of videos) {
      try {
        INFO(`Processando: ${video.titulo}`);

        // Baixa a transcrição só deste vídeo
        const { data: completo, error: erroTrans } = await supabase
          .from('douglas_conteudo_videos')
          .select('transcricao_texto')
          .eq('video_id', video.video_id)
          .single();
        if (erroTrans || !completo?.transcricao_texto) {
          throw new Error(`Transcrição indisponível: ${erroTrans?.message || 'vazia'}`);
        }
        video.transcricao_texto = completo.transcricao_texto;

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

        INFO(`Resumo gerado (${modelo}) - ${resumo.length} chars`);
        if (!resumo || resumo.length === 0) {
          throw new Error('Resumo veio vazio da KPA Labs');
        }

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
        // A coluna é `erro_motivo` (constraint exige motivo quando status='erro').
        // Antes gravava em `erro` (inexistente) → 400 → vídeo ficava preso na fila.
        const { error: erroMarcar } = await supabase
          .from('douglas_conteudo_videos')
          .update({
            status: 'erro',
            erro_motivo: String(err.message).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('video_id', video.video_id);
        if (erroMarcar) ERROR(`Falha ao marcar erro em ${video.video_id}: ${erroMarcar.message}`);

        erros++;
      }
    }

    INFO(`Worker finalizado: ${processados} processados, ${erros} erros`);
    return { processados, erros, pendentes };
  } catch (err) {
    ERROR(`Erro fatal no worker: ${err.message}`);
    return { processados, erros: erros + 1, pendentes: 0 };
  }
}

// ============================================================
// SCHEDULE — Modo on-demand (sem cron fixo)
// O index.js roda em loop contínuo, checando a cada 60s
// ============================================================
