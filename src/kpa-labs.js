/**
 * Cliente KPA Labs (proxy Claude)
 *
 * Modelo por categoria:
 * - teologia → opus (mais profundidade)
 * - estudo → opus
 * - marketing → sonnet (bom custo-benefício)
 * - outro → haiku (rápido)
 */

import axios from 'axios';

const MODELOS_POR_CATEGORIA = {
  teologia: 'claude-opus-4',
  estudo: 'claude-opus-4',
  marketing: 'claude-sonnet-5',
  outro: 'claude-haiku-4',
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function criarClienteKPA() {
  const apiKey = process.env.KPA_LABS_API_KEY;
  const baseUrl = process.env.KPA_LABS_URL || 'https://api.kpalabs.com';

  if (!apiKey) {
    throw new Error('KPA_LABS_API_KEY é obrigatório');
  }

  async function chamarKPA(prompt, modelo) {
    let delay = BASE_DELAY_MS;

    for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
      try {
        const response = await axios.post(
          `${baseUrl}/v1/messages`,
          {
            model: modelo,
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          }
        );

        return response.data.content[0].text;
      } catch (err) {
        const isRetryable =
          err.response?.status === 429 ||
          err.response?.status === 503 ||
          err.code === 'ECONNRESET';

        if (!isRetryable || tentativa === MAX_RETRIES) {
          throw new Error(`KPA Labs erro: ${err.response?.data?.error?.type || err.message}`);
        }

        console.warn(`[kpa] tentativa ${tentativa}/${MAX_RETRIES} falhou, retry em ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  return {
    /**
     * Gera resumo para uma transcrição
     * @param {Object} params
     * @param {string} params.prompt - Prompt com a transcrição
     * @param {string} params.categoria - Categoria do vídeo
     * @returns {Promise<{texto: string, modelo: string}>}
     */
    async gerarResumo({ prompt, categoria }) {
      const modelo = MODELOS_POR_CATEGORIA[categoria] || 'claude-haiku-4';
      const texto = await chamarKPA(prompt, modelo);
      return { texto, modelo };
    },
  };
}
