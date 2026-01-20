/**
 * Главный файл для запуска с использованием config.js
 */

const VolumeMonitor = require('./volume-monitor');
const fs = require('fs');

// Проверяем наличие config.js
let config;

if (fs.existsSync('./config.js')) {
    console.log('✅ Загружаю конфигурацию из config.js');
    config = require('./config');
} else {
    console.log('⚠️  config.js не найден, использую настройки по умолчанию');
    console.log('💡 Создайте config.js из config.example.js для кастомизации');
    
    config = {
        symbols: ['STABLEUSDT', 'BTCUSDT'],
        volumeMultiplier: 2.0,
        checkInterval: 60000,
        historySize: 24,
        telegramToken: '8525128857:AAHhDWWO1dbyxc5zCO9DtoqkAkzNgljiqO8',
        telegramChatId: '864779373'
    };
}

// Валидация конфигурации
if (!config.symbols || config.symbols.length === 0) {
    console.error('❌ Ошибка: не указаны монеты для мониторинга!');
    console.error('💡 Добавьте symbols: [\'STABLEUSDT\', \'BTCUSDT\'] в config.js');
    process.exit(1);
}

// Создаем и запускаем монитор
const monitor = new VolumeMonitor(config);
monitor.start();

// Обработка выхода
process.on('SIGINT', () => {
    console.log('\n\n👋 Останавливаю мониторинг...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Останавливаю мониторинг...');
    process.exit(0);
});
