/**
 * yt-resumo-worker
 * Worker que resume vídeos do YouTube automaticamente via cron
 *
 * Run: node src/index.js
 */

import 'dotenv/config';
import { executarWorker } from './worker.js';

console.log('[yt-resumo-worker] Iniciando...');

// Executa uma vez ao iniciar
executarWorker()
  .then(({ processados, erros }) => {
    console.log(`[yt-resumo-worker] Finalizado: ${processados} processados, ${erros} erros`);
    process.exit(erros > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('[yt-resumo-worker] Erro fatal:', err);
    process.exit(1);
  });
