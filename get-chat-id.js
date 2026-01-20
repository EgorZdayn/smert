/**
 * Утилита для получения Chat ID группы или личного чата
 * 
 * Использование:
 * 1. Напишите боту или в группу любое сообщение
 * 2. Запустите: node get-chat-id.js YOUR_BOT_TOKEN
 * 3. Скопируйте Chat ID из результата
 */

const TelegramBot = require('node-telegram-bot-api');

async function getChatId(token) {
    if (!token) {
        console.error('❌ Ошибка: не указан токен бота!\n');
        console.log('Использование:');
        console.log('  node get-chat-id.js YOUR_BOT_TOKEN');
        console.log('\nПример:');
        console.log('  node get-chat-id.js 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
        process.exit(1);
    }
    
    console.log('\n🔍 Получение Chat ID...\n');
    console.log('═'.repeat(70));
    
    try {
        const bot = new TelegramBot(token, { polling: false });
        
        // Получаем информацию о боте
        const botInfo = await bot.getMe();
        console.log('✅ Бот найден:');
        console.log(`   👤 Имя: ${botInfo.first_name}`);
        console.log(`   🆔 Username: @${botInfo.username}`);
        console.log(`   🔢 Bot ID: ${botInfo.id}\n`);
        
        // Получаем последние обновления
        console.log('⏳ Получаю последние сообщения...\n');
        const updates = await bot.getUpdates();
        
        if (updates.length === 0) {
            console.log('⚠️  Сообщений не найдено!\n');
            console.log('📝 Что делать:');
            console.log('   1. Напишите боту @' + botInfo.username + ' любое сообщение');
            console.log('   2. Или добавьте бота в группу и напишите туда сообщение');
            console.log('   3. Запустите этот скрипт снова\n');
            process.exit(0);
        }
        
        console.log(`✅ Найдено ${updates.length} сообщений\n`);
        console.log('═'.repeat(70));
        
        // Собираем уникальные чаты
        const chats = new Map();
        
        updates.forEach(update => {
            if (update.message && update.message.chat) {
                const chat = update.message.chat;
                chats.set(chat.id, {
                    id: chat.id,
                    type: chat.type,
                    title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim(),
                    username: chat.username
                });
            }
        });
        
        // Выводим все найденные чаты
        console.log('📱 НАЙДЕННЫЕ ЧАТЫ:\n');
        
        let index = 1;
        chats.forEach(chat => {
            console.log(`${index}. ${getChatTypeEmoji(chat.type)} ${chat.type.toUpperCase()}`);
            console.log(`   📝 Название: ${chat.title || 'Личный чат'}`);
            console.log(`   🔢 Chat ID: ${chat.id}`);
            if (chat.username) {
                console.log(`   🆔 Username: @${chat.username}`);
            }
            
            if (chat.type === 'private') {
                console.log(`   💡 Использование: личные уведомления`);
            } else if (chat.type === 'group' || chat.type === 'supergroup') {
                console.log(`   💡 Использование: групповые уведомления (видят все)`);
            }
            
            console.log('   ─'.repeat(65));
            index++;
        });
        
        console.log('\n═'.repeat(70));
        console.log('📋 КАК ИСПОЛЬЗОВАТЬ:\n');
        console.log('Скопируйте нужный Chat ID и добавьте в .env файл:');
        console.log('');
        
        chats.forEach(chat => {
            if (chat.type === 'private') {
                console.log(`# Для личных уведомлений:`);
                console.log(`TELEGRAM_CHAT_ID=${chat.id}`);
            } else if (chat.type === 'group' || chat.type === 'supergroup') {
                console.log(`# Для группы "${chat.title}":`);
                console.log(`TELEGRAM_CHAT_ID=${chat.id}`);
            }
            console.log('');
        });
        
        console.log('═'.repeat(70));
        console.log('✅ Готово!\n');
        
    } catch (error) {
        console.error('\n❌ ОШИБКА!\n');
        
        if (error.response && error.response.body) {
            const errorData = error.response.body;
            console.error('Код ошибки:', errorData.error_code);
            console.error('Описание:', errorData.description);
            
            if (errorData.error_code === 401) {
                console.error('\n💡 Неверный токен бота!');
                console.error('Проверьте токен у @BotFather\n');
            }
        } else {
            console.error('Детали:', error.message, '\n');
        }
        
        process.exit(1);
    }
}

function getChatTypeEmoji(type) {
    switch (type) {
        case 'private':
            return '👤';
        case 'group':
            return '👥';
        case 'supergroup':
            return '👥';
        case 'channel':
            return '📢';
        default:
            return '💬';
    }
}

// Запуск
const token = process.argv[2];

if (!token) {
    // Попытка загрузить из config.js
    const fs = require('fs');
    if (fs.existsSync('./config.js')) {
        console.log('📁 Пытаюсь загрузить токен из config.js...\n');
        try {
            const config = require('./config');
            if (config.telegramToken) {
                getChatId(config.telegramToken);
            } else {
                console.error('❌ Токен не найден в config.js\n');
                getChatId(null);
            }
        } catch (e) {
            console.error('❌ Ошибка загрузки config.js:', e.message, '\n');
            getChatId(null);
        }
    } else {
        getChatId(null);
    }
} else {
    getChatId(token);
}
