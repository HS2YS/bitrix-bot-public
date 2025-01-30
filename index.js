require('dotenv').config({ path: 'keys.env' });

const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.urlencoded({ extended: true }));

// Читаем переменные окружения (из keys.env)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID_PROJECT_1 = process.env.TELEGRAM_CHAT_ID_PROJECT_1;
const TELEGRAM_CHAT_ID_PROJECT_2 = process.env.TELEGRAM_CHAT_ID_PROJECT_2;
const TELEGRAM_CHAT_ID_DEFAULT = process.env.TELEGRAM_CHAT_ID_DEFAULT;
const BITRIX_API_URL = process.env.BITRIX_API_URL;
const PORT = process.env.PORT || 3333;

async function sendMessageToTelegram(chatId, message) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      }
    );
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Telegram:', error);
  }
}

// Обработка POST-запросов на /telegram_webhook
app.post('/telegram_webhook', async (req, res) => {
  const { body } = req;
  const taskId = body.document_id[2]; 
  const taskUrl = `<шаблон ссылки>${taskId}/`; // В конце должен быть ID задачи, указывать его не нужно

  console.log('Полученные данные из Bitrix24:', body);

  try {
    const apiResponse = await axios.get(`${BITRIX_API_URL}?TASKID=${taskId}`);
    const taskData = apiResponse.data.result || {};

    const tags = taskData.TAGS || [];

    // Определяем чат в зависимости от тега в  задаче
    let targetChatId = TELEGRAM_CHAT_ID_DEFAULT;
    if (tags.includes('Проект1')) {
      targetChatId = TELEGRAM_CHAT_ID_PROJECT_1;
    } else if (tags.includes('Проект2')) {
      targetChatId = TELEGRAM_CHAT_ID_PROJECT_2;
    }

    const status = taskData.STATUS; 
    const title = taskData.TITLE;
    const createdDateStr = taskData.CREATED_DATE;

    const createdDate = new Date(createdDateStr);
    const now = new Date();
    const diffMs = now - createdDate;

    // Порог определения новой задачи = 1 минута
    const NEW_TASK_THRESHOLD_MS = 1 * 60 * 1000;

    // и статус задачи 2 или -2 (ждет выполнения)
    let firstLine = '';
    if (status === '2' || status === '-2') {
      if (diffMs >= 0 && diffMs <= NEW_TASK_THRESHOLD_MS) {
        firstLine = 'Новая задача создана! 🆕';
      } else {
        firstLine = 'Задача вернулась в работу 🔄';
      }
    } else if (status === '4') {
      firstLine = 'Задача ждет контроля ⏳';
    } else if (status === '5') {
      firstLine = 'Задача завершена ✅';
    } else {
      firstLine = `Изменение статуса задачи: ${status}`;
    }

    const secondLine = `ID задачи: ${taskId}`;
    const thirdLine = `Наименование задачи: ${title}`;
    const fourthLine = `<a href="${taskUrl}">Ссылка на задачу</a>`;

    const message = [firstLine, secondLine, thirdLine, fourthLine].join('\n');

    await sendMessageToTelegram(targetChatId, message);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Ошибка при получении данных задачи из Bitrix24:', error);
    res.status(500).json({ error: 'Не удалось получить данные задачи' });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
