/**
 * Тестовый скрипт для проверки Telegram уведомлений
 * 
 * Использование:
 * node test-telegram.js YOUR_BOT_TOKEN YOUR_CHAT_ID
 * 
 * Или создайте config.js и просто запустите:
 * node test-telegram.js
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

async function testTelegram(token, chatId) {
    console.log('🔧 Тестирование Telegram бота...\n');
    console.log('═'.repeat(60));
    console.log('📱 Bot Token:', token ? token.substring(0, 20) + '...' : '❌ НЕ УКАЗАН');
    console.log('💬 Chat ID:', chatId || '❌ НЕ УКАЗАН');
    console.log('═'.repeat(60));
    
    if (!token || !chatId) {
        console.error('\n❌ Ошибка: Не указаны токен или chat ID!\n');
        console.log('Использование:');
        console.log('  node test-telegram.js YOUR_BOT_TOKEN YOUR_CHAT_ID');
        console.log('\nИли создайте config.js с параметрами:');
        console.log('  telegramToken: "YOUR_BOT_TOKEN"');
        console.log('  telegramChatId: "YOUR_CHAT_ID"');
        process.exit(1);
    }
    
    try {
        console.log('\n⏳ Создаю бота...');
        const bot = new TelegramBot(token, { polling: false });
        
        console.log('✅ Бот создан');
        console.log('\n⏳ Получаю информацию о боте...');
        
        const botInfo = await bot.getMe();
        console.log('✅ Информация о боте получена:');
        console.log(`   👤 Имя: ${botInfo.first_name}`);
        console.log(`   🆔 Username: @${botInfo.username}`);
        console.log(`   🔢 ID: ${botInfo.id}`);
        
        console.log('\n⏳ Отправляю тестовое сообщение...');
        
        const testMessage = `
🧪 ТЕСТ УВЕДОМЛЕНИЙ

✅ Бот успешно настроен!
📱 Имя бота: ${botInfo.first_name}
🆔 Username: @${botInfo.username}
⏰ Время: ${new Date().toLocaleString('ru-RU')}

🎉 Все работает отлично!
Теперь вы будете получать уведомления об аномальных объемах.
        `.trim();
        
        await bot.sendMessage(chatId, testMessage);
        
        console.log('\n✅ УСПЕХ! Сообщение отправлено!');
        console.log('📱 Проверьте ваш Telegram чат\n');
        console.log('═'.repeat(60));
        console.log('🎉 Telegram настроен правильно!');
        console.log('Теперь можете запускать основной скрипт мониторинга.');
        console.log('═'.repeat(60));
        
    } catch (error) {
        console.error('\n❌ ОШИБКА при отправке сообщения!\n');
        
        if (error.response && error.response.body) {
            const errorData = error.response.body;
            console.error('Детали ошибки:');
            console.error('  Код:', errorData.error_code);
            console.error('  Описание:', errorData.description);
            
            if (errorData.error_code === 401) {
                console.error('\n💡 Проблема: Неверный токен бота');
                console.error('Решение:');
                console.error('  1. Проверьте токен у @BotFather');
                console.error('  2. Убедитесь что вы скопировали весь токен полностью');
            } else if (errorData.error_code === 400) {
                console.error('\n💡 Проблема: Неверный Chat ID или бот не может отправить сообщение');
                console.error('Решение:');
                console.error('  1. Напишите вашему боту ПЕРВОЕ сообщение в Telegram');
                console.error('  2. Проверьте Chat ID у @userinfobot');
                console.error('  3. Убедитесь что Chat ID правильный (число без пробелов)');
            }
        } else {
            console.error('Ошибка:', error.message);
        }
        
        console.error('\n═'.repeat(60));
        console.error('📚 Дополнительная помощь:');
        console.error('  1. Как создать бота: https://t.me/BotFather');
        console.error('  2. Как получить Chat ID: https://t.me/userinfobot');
        console.error('═'.repeat(60));
        
        process.exit(1);
    }
}

// Попытка загрузить config.js
let token = process.argv[2];
let chatId = process.argv[3];

if (!token || !chatId) {
    if (fs.existsSync('./config.js')) {
        console.log('📁 Загружаю настройки из config.js...\n');
        const config = require('./config');
        token = config.telegramToken;
        chatId = config.telegramChatId;
    }
}

testTelegram(token, chatId);
