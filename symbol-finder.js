/**
 * Утилита для получения списка всех торговых пар на MEXC
 * Помогает найти интересные монеты для мониторинга
 */

const axios = require('axios');

class SymbolFinder {
    constructor() {
        this.baseUrl = 'https://api.mexc.com';
    }
    
    async getAllSymbols() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/exchangeInfo`);
            return response.data.symbols;
        } catch (error) {
            console.error('❌ Ошибка при получении списка символов:', error.message);
            return [];
        }
    }
    
    async get24hTickers() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v3/ticker/24hr`);
            return Array.isArray(response.data) ? response.data : [response.data];
        } catch (error) {
            console.error('❌ Ошибка при получении тикеров:', error.message);
            return [];
        }
    }
    
    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    }
    
    async findLowCapCoins(minVolume = 50000, maxVolume = 500000) {
        console.log('\n🔍 Поиск низкокапитализированных монет...\n');
        
        const tickers = await this.get24hTickers();
        
        const filtered = tickers
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol,
                volume: parseFloat(t.quoteVolume),
                priceChange: parseFloat(t.priceChangePercent),
                price: parseFloat(t.lastPrice)
            }))
            .filter(t => t.volume >= minVolume && t.volume <= maxVolume)
            .sort((a, b) => b.volume - a.volume);
        
        console.log(`📊 Найдено ${filtered.length} монет с объемом $${this.formatVolume(minVolume)} - $${this.formatVolume(maxVolume)}\n`);
        console.log('═'.repeat(80));
        console.log('Символ'.padEnd(20) + 'Объем 24ч'.padEnd(20) + 'Изм. %'.padEnd(15) + 'Цена');
        console.log('═'.repeat(80));
        
        filtered.slice(0, 30).forEach(coin => {
            const changeEmoji = coin.priceChange > 0 ? '📈' : coin.priceChange < 0 ? '📉' : '➡️';
            console.log(
                coin.symbol.padEnd(20) +
                `$${this.formatVolume(coin.volume)}`.padEnd(20) +
                `${changeEmoji} ${coin.priceChange.toFixed(2)}%`.padEnd(15) +
                `$${coin.price}`
            );
        });
        
        return filtered;
    }
    
    async findHighVolatilityCoins(minPriceChange = 10) {
        console.log('\n🔥 Поиск высоковолатильных монет...\n');
        
        const tickers = await this.get24hTickers();
        
        const filtered = tickers
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol,
                volume: parseFloat(t.quoteVolume),
                priceChange: parseFloat(t.priceChangePercent),
                price: parseFloat(t.lastPrice)
            }))
            .filter(t => Math.abs(t.priceChange) >= minPriceChange && t.volume > 10000)
            .sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
        
        console.log(`📊 Найдено ${filtered.length} монет с изменением цены >= ${minPriceChange}%\n`);
        console.log('═'.repeat(80));
        console.log('Символ'.padEnd(20) + 'Изм. %'.padEnd(20) + 'Объем 24ч'.padEnd(20) + 'Цена');
        console.log('═'.repeat(80));
        
        filtered.slice(0, 30).forEach(coin => {
            const changeEmoji = coin.priceChange > 0 ? '🚀' : '💥';
            console.log(
                coin.symbol.padEnd(20) +
                `${changeEmoji} ${coin.priceChange.toFixed(2)}%`.padEnd(20) +
                `$${this.formatVolume(coin.volume)}`.padEnd(20) +
                `$${coin.price}`
            );
        });
        
        return filtered;
    }
    
    async findTopVolumeCoins(limit = 30) {
        console.log('\n💰 Топ монет по объему торгов...\n');
        
        const tickers = await this.get24hTickers();
        
        const filtered = tickers
            .filter(t => t.symbol.endsWith('USDT'))
            .map(t => ({
                symbol: t.symbol,
                volume: parseFloat(t.quoteVolume),
                priceChange: parseFloat(t.priceChangePercent),
                price: parseFloat(t.lastPrice)
            }))
            .sort((a, b) => b.volume - a.volume);
        
        console.log(`📊 Топ ${limit} монет по объему торгов\n`);
        console.log('═'.repeat(80));
        console.log('#'.padEnd(5) + 'Символ'.padEnd(20) + 'Объем 24ч'.padEnd(25) + 'Изм. %');
        console.log('═'.repeat(80));
        
        filtered.slice(0, limit).forEach((coin, index) => {
            const changeEmoji = coin.priceChange > 0 ? '📈' : coin.priceChange < 0 ? '📉' : '➡️';
            console.log(
                `${index + 1}.`.padEnd(5) +
                coin.symbol.padEnd(20) +
                `$${this.formatVolume(coin.volume)}`.padEnd(25) +
                `${changeEmoji} ${coin.priceChange.toFixed(2)}%`
            );
        });
        
        return filtered;
    }
    
    async suggestCoinsForMonitoring() {
        console.log('\n🎯 РЕКОМЕНДАЦИИ ДЛЯ МОНИТОРИНГА\n');
        console.log('═'.repeat(80));
        
        // 1. Низкокапитализированные с умеренным объемом
        console.log('\n1️⃣  Низкокапитализированные (легко манипулируются):');
        const lowCap = await this.findLowCapCoins(50000, 300000);
        
        // 2. Высоковолатильные
        console.log('\n2️⃣  Высоковолатильные (активная торговля):');
        const volatile = await this.findHighVolatilityCoins(15);
        
        // Генерируем список для config.js
        const suggestions = [
            ...lowCap.slice(0, 5),
            ...volatile.slice(0, 5)
        ];
        
        const uniqueSymbols = [...new Set(suggestions.map(c => c.symbol))];
        
        console.log('\n\n✅ ГОТОВЫЙ СПИСОК ДЛЯ config.js:\n');
        console.log('symbols: [');
        uniqueSymbols.slice(0, 10).forEach(symbol => {
            console.log(`    '${symbol}',`);
        });
        console.log('],\n');
    }
}

// Запуск
if (require.main === module) {
    const finder = new SymbolFinder();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'lowcap':
            finder.findLowCapCoins();
            break;
        case 'volatile':
            finder.findHighVolatilityCoins();
            break;
        case 'top':
            const limit = parseInt(args[1]) || 30;
            finder.findTopVolumeCoins(limit);
            break;
        case 'suggest':
        default:
            finder.suggestCoinsForMonitoring();
            break;
    }
}

module.exports = SymbolFinder;
