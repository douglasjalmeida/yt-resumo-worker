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

// Intervalos (reduzem egress do Supabase free):
// - fila vazia: 5 min; fila com progresso: 60 s; sem progresso: backoff 2x até 30 min
const INTERVALO_OCIOSO_MS = 5 * 60 * 1000;
const INTERVALO_MAX_MS = 30 * 60 * 1000;
let falhasSeguidas = 0;

async function loop() {
  let proximoMs = INTERVALO_OCIOSO_MS;
  try {
    const { processados, erros, pendentes } = await executarWorker({ silencioso: true });

    if (processados > 0 || erros > 0) {
      console.log(`[yt-resumo-worker] Ciclo: ${processados} processados, ${erros} erros`);
    }

    if (processados > 0) {
      falhasSeguidas = 0;
      proximoMs = INTERVALO_CHECAGEM_MS;
    } else if (pendentes > 0 || erros > 0) {
      falhasSeguidas++;
      proximoMs = Math.min(INTERVALO_CHECAGEM_MS * 2 ** falhasSeguidas, INTERVALO_MAX_MS);
    } else {
      falhasSeguidas = 0;
    }
  } catch (err) {
    console.error('[yt-resumo-worker] Erro no ciclo:', err.message);
    falhasSeguidas++;
    proximoMs = Math.min(INTERVALO_CHECAGEM_MS * 2 ** falhasSeguidas, INTERVALO_MAX_MS);
  }
  setTimeout(loop, proximoMs);
}

// Primeira execução imediata; as seguintes se agendam sozinhas
loop();

// Keep alive
process.stdin.resume();
