/**
 * MEXC Volume Monitor v2.0
 * Отслеживает аномальные объемы торговли на SPOT и FUTURES
 * Поддерживает как спотовый, так и фьючерсный рынок
 */

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

class VolumeMonitor {
    constructor(config) {
        // Базовые URL для разных рынков
        this.spotBaseUrl = 'https://api.mexc.com';
        this.futuresBaseUrl = 'https://contract.mexc.com';
        
        this.symbols = config.symbols || ['STABLEUSDT'];
        this.volumeMultiplier = config.volumeMultiplier || 2.0;
        this.checkInterval = config.checkInterval || 60000;
        this.historySize = config.historySize || 24;
        
        // Тип рынка для каждого символа
        // Формат: { 'BTCUSDT': 'spot', 'BTC_USDT': 'futures' }
        this.marketTypes = config.marketTypes || {};
        
        // Telegram bot (опционально)
        this.telegramToken = config.telegramToken;
        this.telegramChatId = config.telegramChatId;
        this.bot = null;
        
        if (this.telegramToken && this.telegramChatId) {
            this.bot = new TelegramBot(this.telegramToken, { polling: false });
        }
        
        // История объемов для каждого символа
        this.volumeHistory = {};
        this.lastVolumes = {};
        
        // Инициализация истории
        this.symbols.forEach(symbol => {
            this.volumeHistory[symbol] = [];
        });
        
        this.printStartupInfo();
    }
    
    printStartupInfo() {
        console.log('🚀 MEXC Volume Monitor v2.0 запущен!');
        console.log('═'.repeat(60));
        console.log(`📊 Отслеживаемые пары: ${this.symbols.length}`);
        
        // Подсчет по типам
        let spotCount = 0;
        let futuresCount = 0;
        
        this.symbols.forEach(symbol => {
            const marketType = this.getMarketType(symbol);
            if (marketType === 'futures') futuresCount++;
            else spotCount++;
        });
        
        console.log(`   💰 Спот: ${spotCount} | 📈 Фьючерсы: ${futuresCount}`);
        console.log(`🔥 Порог аномалии: x${this.volumeMultiplier}`);
        console.log(`⏱️  Интервал проверки: ${this.checkInterval / 1000}с`);
        console.log(`📱 Telegram: ${this.bot ? '✅ включен' : '❌ выключен'}`);
        console.log('═'.repeat(60));
        
        // Показываем список пар
        console.log('\n📋 Список пар:');
        this.symbols.forEach((symbol, i) => {
            const marketType = this.getMarketType(symbol);
            const emoji = marketType === 'futures' ? '📈' : '💰';
            console.log(`   ${i + 1}. ${emoji} ${symbol} (${marketType})`);
        });
        console.log('');
    }
    
    /**
     * Определяет тип рынка (spot или futures)
     */
    getMarketType(symbol) {
        // Если явно указан в конфиге
        if (this.marketTypes[symbol]) {
            return this.marketTypes[symbol];
        }
        
        // Автоопределение по формату
        // Фьючерсы: BTC_USDT (с подчеркиванием)
        // Спот: BTCUSDT (без подчеркивания)
        if (symbol.includes('_')) {
            return 'futures';
        }
        
        return 'spot';
    }
    
    /**
     * Получает статистику за 24 часа для SPOT
     */
    async getSpot24hTicker(symbol) {
        try {
            const response = await axios.get(`${this.spotBaseUrl}/api/v3/ticker/24hr`, {
                params: { symbol },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка Spot API для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Получает данные тикера для FUTURES
     */
    async getFuturesTicker(symbol) {
        try {
            const response = await axios.get(`${this.futuresBaseUrl}/api/v1/contract/ticker`, {
                params: { symbol },
                timeout: 10000
            });
            
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ Ошибка Futures API для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Получает последние свечи для SPOT
     */
    async getSpotKlines(symbol, interval = '5m', limit = 12) {
        try {
            const response = await axios.get(`${this.spotBaseUrl}/api/v3/klines`, {
                params: { symbol, interval, limit },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            console.error(`❌ Ошибка получения Spot свечей для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Получает последние свечи для FUTURES
     */
    async getFuturesKlines(symbol, interval = 'Min5', limit = 12) {
        try {
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (limit * 5 * 60); // 5 минут * количество свечей
            
            const response = await axios.get(`${this.futuresBaseUrl}/api/v1/contract/kline/${symbol}`, {
                params: {
                    interval,
                    start: startTime,
                    end: endTime
                },
                timeout: 10000
            });
            
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return null;
        } catch (error) {
            console.error(`❌ Ошибка получения Futures свечей для ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Анализирует объемы по свечам (SPOT)
     */
    async analyzeSpotVolumes(symbol) {
        const klines = await this.getSpotKlines(symbol, '5m', 12);
        if (!klines || klines.length === 0) return null;
        
        // Формат Spot: [openTime, open, high, low, close, volume, closeTime, quoteVolume]
        const volumes = klines.map(candle => parseFloat(candle[7])); // quoteVolume в USDT
        
        const currentVolume = volumes[volumes.length - 1];
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
     * Анализирует объемы по свечам (FUTURES)
     */
    async analyzeFuturesVolumes(symbol) {
        const data = await this.getFuturesKlines(symbol, 'Min5', 12);
        if (!data) return null;
        
        // Формат Futures: { time: [...], open: [...], close: [...], vol: [...], amount: [...] }
        const volumes = data.amount || []; // amount = объем в USDT
        
        if (volumes.length === 0) return null;
        
        const currentVolume = volumes[volumes.length - 1];
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
        
        if (this.volumeHistory[symbol].length > this.historySize) {
            this.volumeHistory[symbol].shift();
        }
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
        
        const marketType = this.getMarketType(symbol);
        const marketEmoji = marketType === 'futures' ? '📈' : '💰';
        const marketLabel = marketType === 'futures' ? 'FUTURES' : 'SPOT';
        
        // URL для торговли
        let tradingUrl;
        if (marketType === 'futures') {
            tradingUrl = `https://futures.mexc.com/exchange/${symbol}`;
        } else {
            tradingUrl = `https://www.mexc.com/exchange/${symbol}`;
        }
        
        const message = `
🚨 АНОМАЛЬНЫЙ ОБЪЕМ ОБНАРУЖЕН! 🚨

${marketEmoji} Тип: ${marketLabel}
💰 Монета: ${symbol}
📊 Текущий объем: $${this.formatNumber(data.currentVolume)}
📈 Средний объем: $${this.formatNumber(data.avgVolume)}
🔥 Множитель: x${data.multiplier.toFixed(2)}

⏰ Время: ${new Date().toLocaleString('ru-RU')}

🔗 Трейдинг: ${tradingUrl}
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
        const marketType = this.getMarketType(symbol);
        const marketEmoji = marketType === 'futures' ? '📈' : '💰';
        
        console.log(`\n🔍 Проверка ${marketEmoji} ${symbol} (${marketType})...`);
        
        let recentAnalysis;
        let volume24h = 0;
        
        // Получаем данные в зависимости от типа рынка
        if (marketType === 'futures') {
            const ticker = await this.getFuturesTicker(symbol);
            if (ticker && ticker.volume24) {
                volume24h = parseFloat(ticker.volume24);
            }
            recentAnalysis = await this.analyzeFuturesVolumes(symbol);
        } else {
            const ticker24h = await this.getSpot24hTicker(symbol);
            if (ticker24h) {
                volume24h = parseFloat(ticker24h.quoteVolume);
            }
            recentAnalysis = await this.analyzeSpotVolumes(symbol);
        }
        
        if (!recentAnalysis) {
            console.log(`  ⚠️  Не удалось получить данные`);
            return;
        }
        
        const { currentVolume, avgPreviousVolume, multiplier } = recentAnalysis;
        
        // Добавляем текущий объем в историю
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

module.exports = VolumeMonitor;

// Если запущен напрямую
if (require.main === module) {
    const config = {
        // Пример конфигурации с обоими типами рынков
        symbols: [
            'STABLEUSDT',      // Spot (автоопределение)
            'BTC_USDT',        // Futures (автоопределение по _)
            'AUDIO_USDT'
            // 'ETHUSDT',      // Spot
            // 'ETH_USDT',     // Futures
        ],
        volumeMultiplier: 2.0,
        checkInterval: 60000,
        historySize: 24,
        
        // Явное указание типа рынка (опционально)
        marketTypes: {
            // 'BTCUSDT': 'spot',
            // 'BTC_USDT': 'futures',
        },
        
        // Telegram (опционально)
        // telegramToken: 'YOUR_BOT_TOKEN',
        // telegramChatId: 'YOUR_CHAT_ID'
    };
    
    const monitor = new VolumeMonitor(config);
    monitor.start();
}
