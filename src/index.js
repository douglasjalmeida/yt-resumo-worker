/**
 * yt-resumo-worker (ON-DEMAND)
 * Loop contínuo que checa a cada 60s por vídeos pendentes e processa imediatamente.
 *
 * Cronograma:
 * - A cada 60s: checa fila
 * - Se tiver vídeo com status='transcrito' E resumo_md IS NULL: processa na hora
 * - Notifica WhatsApp via douglas-ia
 */

import 'dotenv/config';
import { executarWorker } from './worker.js';

const INTERVALO_CHECAGEM_MS = 60 * 1000; // 60 segundos

function log(tipo, mensagem) {
  const agora = new Date().toISOString();
  console.log(`[${agora}] ${tipo}: ${mensagem}`);
}

console.log('[yt-resumo-worker] Modo ON-DEMAND iniciado');
console.log(`[yt-resumo-worker] Checando a cada ${INTERVALO_CHECAGEM_MS / 1000}s`);

// Loop principal
async function loop() {
  try {
    const { processados, erros } = await executarWorker({ silencioso: true });

    if (processados > 0 || erros > 0) {
      console.log(`[yt-resumo-worker] Ciclo: ${processados} processados, ${erros} erros`);
    }
  } catch (err) {
    console.error('[yt-resumo-worker] Erro no ciclo:', err.message);
  }
}

// Primeira execução imediata
loop();

// Depois, a cada 60s
setInterval(loop, INTERVALO_CHECAGEM_MS);

// Keep alive
process.stdin.resume();
