/**
 * Notificador via Webhook douglas-ia
 * Envia mensagem pro WhatsApp do Douglas via douglas-ia
 */

import axios from 'axios';

export function criarNotificador() {
  const webhookUrl = process.env.DOUGLAS_IA_WEBHOOK_URL || 'https://douglas-ia.fly.dev/notificar-resumo';

  if (!webhookUrl) {
    console.warn('[notificador] DOUGLAS_IA_WEBHOOK_URL não configurado - notificações desativadas');
    return {
      enviarMensagem: async () => {
        console.warn('[notificador] Notificação ignorada (configuração ausente)');
      },
    };
  }

  return {
    /**
     * Envia notificação de resumo via douglas-ia
     * @param {Object} params
     * @param {string} params.titulo - Título do vídeo
     * @param {string} params.resumo - Resumo do vídeo
     * @param {string} params.youtubeId - ID do YouTube
     */
    async enviarMensagem({ titulo, resumo, youtubeId }) {
      await axios.post(webhookUrl, {
        titulo,
        resumo,
        youtubeId,
      });
    },
  };
}
