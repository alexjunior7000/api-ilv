const axios = require('axios');
const promiseLimit = require('promise-limit');
const cors = require('cors');

// Configuração de CORS
const corsHandler = cors({
    origin: '*', // Ajuste conforme necessário
});

// Função para delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Função para processar um único ID com retentativas
const processId = async (id, intervalo, maxRetries = 5, retryDelay = 20000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            await delay(intervalo);
            const response = await axios.get(`https://api.illuvium-game.io/gamedata/assets/offchain/illuvials/${id}`);
            console.log(`${id}: success`)
            return { id, data: response.data };
        } catch (error) {
            if (error.response && error.response.status === 403) {
                attempt++;
                console.warn(`Erro 403 ao processar ID ${id}. Tentativa ${attempt}/${maxRetries}. Aguardando ${retryDelay / 1000} segundos antes de retentar...`);
                await delay(retryDelay);
            } else {
                // Para outros erros, retorne o erro imediatamente
                console.log(`${id}: error ${error.message}`)
                return { id, error: error.message };
            }
        }
    }
    // Se todas as tentativas falharem, retorne o erro 403
    return { id, error: 'Erro 403: Limite de requisições atingido após múltiplas tentativas.' };
};

module.exports = async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }

        const { ids, intervalo } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'Parâmetro "ids" deve ser um array' });
        }

        // Configuração do limite de concorrência
        const limit = promiseLimit(5); // Ajuste conforme necessário

        const resultados = {};

        // Função para processar todos os IDs
        const processAllIds = async () => {
            const tasks = ids.map((id) =>
                limit(() => processId(id, intervalo))
            );

            const results = await Promise.all(tasks);
            results.forEach((result) => {
                if (result.data) {
                    resultados[result.id] = result.data;
                } else {
                    resultados[result.id] = { error: result.error };
                }
            });
        };

        try {
            await processAllIds();
            res.status(200).json(resultados);
        } catch (error) {
            console.error('Erro ao processar as requisições:', error);
            res.status(500).json({ error: 'Erro interno ao processar as requisições.' });
        }
    });
};
