/**
 * MEXC Volume Monitor
 * Отслеживает аномальные объемы торговли на бирже MEXC
 * Обнаруживает монеты, через которые переливают большие деньги
 */

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

class VolumeMonitor {
    constructor(config) {
        this.baseUrl = 'https://api.mexc.com';
        this.symbols = config.symbols || ['STABLEUSDT'];
        this.volumeMultiplier = config.volumeMultiplier || 2.0;
        this.checkInterval = config.checkInterval || 60000; // 60 секунд
        this.historySize = config.historySize || 24; // храним 24 последних значения
        
        // История объемов для каждого символа
        this.volumeHistory = {};
        this.lastVolumes = {};
        
        // Telegram bot (опционально)
        this.telegramToken = config.telegramToken;
        this.telegramChatId = config.telegramChatId;
        this.bot = null;
        
        if (this.telegramToken && this.telegramChatId) {
            this.bot = new TelegramBot(this.telegramToken, { polling: false });
        }
        
        // Инициализация истории
        this.symbols.forEach(symbol => {
            this.volumeHistory[symbol] = [];
        });
        
        this.printStartupInfo();
    }
    
    printStartupInfo() {
        console.log('🚀 MEXC Volume Monitor запущен!');
        console.log('═'.repeat(60));
        console.log(`📊 Отслеживаемые монеты: ${this.symbols.join(', ')}`);
        console.log(`🔥 Порог аномалии: x${this.volumeMultiplier}`);
        console.log(`⏱️  Интервал проверки: ${this.checkInterval / 1000}с`);
        console.log(`📱 Telegram уведомления: ${this.bot ? '✅ включены' : '❌ выключены'}`);
        console.log('═'.repeat(60));
        console.log(process.env.TELEGRAM_BOT_TOKEN);
        console.log(process.env.TELEGRAM_CHAT_ID);
    }
    
    /**
     * Получает статистику за 24 часа
     */
    async get24hTicker(symbol) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/ticker/24hr`, {
                params: { symbol },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка при получении данных для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Получает последние свечи для детального анализа
     */
    async getRecentKlines(symbol, interval = '5m', limit = 12) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/klines`, {
                params: { symbol, interval, limit },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка при получении свечей для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Рассчитывает средний объем из истории
     */
    calculateAverageVolume(symbol) {
        const history = this.volumeHistory[symbol];
        if (history.length === 0) return 0;
        
        const sum = history.reduce((acc, val) => acc + val, 0);
        return sum / history.length;
    }
    
    /**
     * Добавляет объем в историю
     */
    addVolumeToHistory(symbol, volume) {
        if (!this.volumeHistory[symbol]) {
            this.volumeHistory[symbol] = [];
        }
        
        this.volumeHistory[symbol].push(volume);
        
        // Ограничиваем размер истории
        if (this.volumeHistory[symbol].length > this.historySize) {
            this.volumeHistory[symbol].shift();
        }
    }
    
    /**
     * Анализирует объемы по 5-минутным свечам
     */
    async analyzeRecentVolumes(symbol) {
        const klines = await this.getRecentKlines(symbol, '5m', 12);
        if (!klines || klines.length === 0) return null;
        
        // Извлекаем объемы из последних свечей
        // Формат: [openTime, open, high, low, close, volume, closeTime, quoteVolume]
        const volumes = klines.map(candle => parseFloat(candle[7])); // quoteVolume в USDT
        
        // Текущий объем (последняя свеча)
        const currentVolume = volumes[volumes.length - 1];
        
        // Средний объем предыдущих свечей
        const previousVolumes = volumes.slice(0, -1);
        const avgPreviousVolume = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;
        
        return {
            currentVolume,
            avgPreviousVolume,
            volumes,
            multiplier: avgPreviousVolume > 0 ? currentVolume / avgPreviousVolume : 0
        };
    }
    
    /**
     * Форматирует число с разделителями
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    }
    
    /**
     * Отправляет уведомление в Telegram
     */
    async sendTelegramAlert(symbol, data) {
        if (!this.bot) return;
        
        const message = `
🚨 АНОМАЛЬНЫЙ ОБЪЕМ ОБНАРУЖЕН! 🚨

💰 Монета: ${symbol}
📊 Текущий объем: $${this.formatNumber(data.currentVolume)}
📈 Средний объем: $${this.formatNumber(data.avgVolume)}
🔥 Множитель: x${data.multiplier.toFixed(2)}

⏰ Время: ${new Date().toLocaleString('ru-RU')}

🔗 Трейдинг: https://www.mexc.com/exchange/${symbol}
        `.trim();
        
        try {
            await this.bot.sendMessage(this.telegramChatId, message);
            console.log(`✅ Уведомление отправлено в Telegram`);
        } catch (error) {
            console.error('❌ Ошибка отправки в Telegram:', error.message);
        }
    }
    
    /**
     * Проверяет один символ на аномалии
     */
    async checkSymbol(symbol) {
        console.log(`\n🔍 Проверка ${symbol}...`);
        
        // Получаем данные за 24 часа
        const ticker24h = await this.get24hTicker(symbol);
        if (!ticker24h) return;
        
        const volume24h = parseFloat(ticker24h.quoteVolume);
        
        // Анализируем последние 5-минутные свечи
        const recentAnalysis = await this.analyzeRecentVolumes(symbol);
        if (!recentAnalysis) return;
        
        const { currentVolume, avgPreviousVolume, multiplier } = recentAnalysis;
        
        // Добавляем текущий объем в историю (используем объем из 5-мин свечи)
        this.addVolumeToHistory(symbol, currentVolume);
        
        // Получаем средний исторический объем
        const avgHistoricalVolume = this.calculateAverageVolume(symbol);
        
        console.log(`  💵 Объем 24ч: $${this.formatNumber(volume24h)}`);
        console.log(`  📊 Текущий объем (5м): $${this.formatNumber(currentVolume)}`);
        console.log(`  📉 Средний объем (5м): $${this.formatNumber(avgPreviousVolume)}`);
        console.log(`  📈 Исторический средний: $${this.formatNumber(avgHistoricalVolume)}`);
        
        // Проверяем аномалию
        if (avgHistoricalVolume > 0) {
            const historicalMultiplier = currentVolume / avgHistoricalVolume;
            
            if (historicalMultiplier >= this.volumeMultiplier) {
                console.log(`  🚨 АНОМАЛИЯ! Объем вырос в ${historicalMultiplier.toFixed(2)}x раз!`);
                
                await this.sendTelegramAlert(symbol, {
                    currentVolume,
                    avgVolume: avgHistoricalVolume,
                    multiplier: historicalMultiplier
                });
            } else {
                console.log(`  ✅ Норма (x${historicalMultiplier.toFixed(2)})`);
            }
        } else {
            console.log(`  ⏳ Накопление данных... (${this.volumeHistory[symbol].length}/${this.historySize})`);
        }
    }
    
    /**
     * Главный цикл мониторинга
     */
    async monitorLoop() {
        while (true) {
            const timestamp = new Date().toLocaleString('ru-RU');
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`⏰ ${timestamp}`);
            console.log(`${'═'.repeat(60)}`);
            
            for (const symbol of this.symbols) {
                await this.checkSymbol(symbol);
                // Небольшая задержка между запросами
                await this.sleep(1000);
            }
            
            console.log(`\n⏳ Следующая проверка через ${this.checkInterval / 1000}с...`);
            await this.sleep(this.checkInterval);
        }
    }
    
    /**
     * Вспомогательная функция для задержки
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Запуск мониторинга
     */
    start() {
        console.log('\n▶️  Запуск мониторинга...\n');
        this.monitorLoop().catch(error => {
            console.error('❌ Критическая ошибка:', error);
            process.exit(1);
        });
    }
}

// Экспорт для использования как модуль
module.exports = VolumeMonitor;

// Если запущен напрямую
if (require.main === module) {
    // Конфигурация
    const config = {
        symbols: ['STABLEUSDT'], // Добавьте больше монет по необходимости
        volumeMultiplier: 2.0,    // x2 аномалия
        checkInterval: 60000,      // Проверка каждую минуту
        historySize: 24,           // Храним 24 последних значения
        
        // Telegram (опционально - закомментируйте если не нужно)
        // telegramToken: 'YOUR_BOT_TOKEN',
        // telegramChatId: 'YOUR_CHAT_ID'
    };
    
    const monitor = new VolumeMonitor(config);
    monitor.start();
}
