/**
 * Cliente Telegram
 */

import axios from 'axios';

export function criarClienteTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados - notificações desativadas');
    return {
      enviarMensagem: async () => {
        console.warn('[telegram] Notificação ignorada (configuração ausente)');
      },
    };
  }

  const apiUrl = `https://api.telegram.org/bot${botToken}`;

  return {
    /**
     * Envia mensagem de notificação
     * @param {Object} params
     * @param {string} params.titulo - Título do vídeo
     * @param {string} params.resumo - Resumo curto
     * @param {string} params.youtubeId - ID do YouTube
     */
    async enviarMensagem({ titulo, resumo, youtubeId }) {
      const mensagem = `🎬 *Novo resumo gerado*

_${titulo}_

${resumo}...

👆 Assistir: https://youtube.com/watch?v=${youtubeId}`;

      await axios.post(`${apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: mensagem,
        parse_mode: 'Markdown',
      });
    },
  };
}
