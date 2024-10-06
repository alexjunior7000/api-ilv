// api/consultas.js

const axios = require('axios');
const promiseLimit = require('promise-limit');
const cors = require('cors');

const corsHandler = cors({
    origin: '*',
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processId = async (id, intervalo, maxRetries = 5, retryDelay = 30000) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            await delay(intervalo);
            const response = await axios.get(`https://api.illuvium-game.io/gamedata/assets/offchain/illuvials/${id}`);
            console.log(`${id} success`)
            return { id, data: response.data };
        } catch (error) {
            if (error.response && error.response.status === 403) {
                attempt++;
                console.warn(`Erro 403 ao processar ID ${id}. Tentativa ${attempt}/${maxRetries}. Aguardando ${retryDelay / 1000} segundos antes de retentar...`);
                await delay(retryDelay);
            } else {
                console.log(`${id} error: ${error.message}`)
                return { id, error: error.message };
            }
        }
    }
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

        // Definir tamanho do lote
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < ids.length; i += batchSize) {
            batches.push(ids.slice(i, i + batchSize));
        }

        const limit = promiseLimit(5); // Controle de concorrência

        const resultados = {};

        try {
            for (const batch of batches) {
                const tasks = batch.map((id) => limit(() => processId(id, intervalo)));
                const results = await Promise.all(tasks);
                results.forEach((result) => {
                    if (result.data) {
                        resultados[result.id] = result.data;
                    } else {
                        resultados[result.id] = { error: result.error };
                    }
                });
            }

            res.status(200).json(resultados);
        } catch (error) {
            console.error('Erro ao processar as requisições:', error);
            res.status(500).json({ error: 'Erro interno ao processar as requisições.' });
        }
    });
};
