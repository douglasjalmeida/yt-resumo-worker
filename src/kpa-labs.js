/**
 * Cliente KPA Labs (proxy Claude via Anthropic API)
 *
 * Usa o mesmo padrão do douglas-ia: ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY
 * O KPA Labs é um proxy da Anthropic API — só precisa trocar a base URL.
 *
 * Modelo padrão: Opus 5 (mais profundo, melhor qualidade)
 * O cron roda apenas 2x/dia (00:00 e 12:00), então o custo extra
 * do Opus é aceitável pela qualidade superior.
 */

import axios from 'axios';

const MODELO_PADRAO = 'claude-opus-5';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function criarClienteKPA() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.kpalabz.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY é obrigatório');
  }

  async function chamarKPA(prompt, modelo) {
    let delay = BASE_DELAY_MS;

    for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
      try {
        const response = await axios.post(
          `${baseUrl}/v1/messages`,
          {
            model: modelo,
            max_tokens: 8192,  // Aumentado para acomodar resumos longos
            thinking: { type: "disabled" },  // Desabilita thinking mode
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

        // Tenta extrair texto da resposta (suporta múltiplos formatos)
        const data = response.data;
        let texto = null;

        if (data.content && Array.isArray(data.content) && data.content.length > 0) {
          // Procura o bloco com 'text' (ignora 'thinking' blocks)
          for (const block of data.content) {
            if (block.type === 'text' && block.text) {
              texto = block.text;
              break;
            }
          }
          // Fallback: se não achar 'type=text', pega o primeiro com .text
          if (!texto) {
            for (const block of data.content) {
              if (block.text) {
                texto = block.text;
                break;
              }
            }
          }
          // Fallback: string
          if (!texto && typeof data.content[0] === 'string') {
            texto = data.content[0];
          }
        } else if (data.completion) {
          texto = data.completion;
        } else if (data.text) {
          texto = data.text;
        } else if (typeof data === 'string') {
          texto = data;
        }

        if (!texto) {
          throw new Error(`Resposta da KPA Labs sem texto. Status: ${response.status}, Data: ${JSON.stringify(data).substring(0, 500)}`);
        }

        return texto;
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
     * Gera resumo para uma transcrição usando Opus 5
     * @param {Object} params
     * @param {string} params.prompt - Prompt com a transcrição
     * @param {string} [params.categoria] - Categoria do vídeo (não usado, sempre Opus)
     * @returns {Promise<{texto: string, modelo: string}>}
     */
    async gerarResumo({ prompt }) {
      const texto = await chamarKPA(prompt, MODELO_PADRAO);
      return { texto, modelo: MODELO_PADRAO };
    },
  };
}
