/**
 * Утилита для поиска фьючерсных пар на MEXC
 * Помогает найти интересные фьючерсы для мониторинга
 */

const axios = require('axios');

class FuturesSymbolFinder {
    constructor() {
        this.baseUrl = 'https://contract.mexc.com';
    }
    
    async getAllContracts() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/contract/detail`);
            if (response.data && response.data.success) {
                return Array.isArray(response.data.data) ? response.data.data : [response.data.data];
            }
            return [];
        } catch (error) {
            console.error('❌ Ошибка при получении списка контрактов:', error.message);
            return [];
        }
    }
    
    async getAllTickers() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/contract/ticker`);
            if (response.data && response.data.success) {
                return Array.isArray(response.data.data) ? response.data.data : [response.data.data];
            }
            return [];
        } catch (error) {
            console.error('❌ Ошибка при получении тикеров:', error.message);
            return [];
        }
    }
    
    formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(2) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    }
    
    async findTopVolumeContracts(limit = 30) {
        console.log('\n💰 Топ фьючерсов по объему торгов...\n');
        
        const tickers = await this.getAllTickers();
        
        const filtered = tickers
            .filter(t => t.symbol && t.volume24)
            .map(t => ({
                symbol: t.symbol,
                volume24: parseFloat(t.volume24) || 0,
                riseFallRate: parseFloat(t.riseFallRate) || 0,
                lastPrice: parseFloat(t.lastPrice) || 0
            }))
            .sort((a, b) => b.volume24 - a.volume24);
        
        console.log(`📊 Топ ${Math.min(limit, filtered.length)} фьючерсов по объему\n`);
        console.log('═'.repeat(90));
        console.log('#'.padEnd(5) + 'Символ'.padEnd(25) + 'Объем 24ч'.padEnd(25) + 'Изм. %'.padEnd(20) + 'Цена');
        console.log('═'.repeat(90));
        
        filtered.slice(0, limit).forEach((contract, index) => {
            const changeEmoji = contract.riseFallRate > 0 ? '📈' : contract.riseFallRate < 0 ? '📉' : '➡️';
            const changePercent = (contract.riseFallRate * 100).toFixed(2);
            console.log(
                `${index + 1}.`.padEnd(5) +
                contract.symbol.padEnd(25) +
                `$${this.formatVolume(contract.volume24)}`.padEnd(25) +
                `${changeEmoji} ${changePercent}%`.padEnd(20) +
                `$${contract.lastPrice}`
            );
        });
        
        return filtered;
    }
    
    async findHighVolatilityContracts(minPriceChange = 5) {
        console.log('\n🔥 Высоковолатильные фьючерсы...\n');
        
        const tickers = await this.getAllTickers();
        
        const filtered = tickers
            .filter(t => t.symbol && t.riseFallRate)
            .map(t => ({
                symbol: t.symbol,
                volume24: parseFloat(t.volume24) || 0,
                riseFallRate: parseFloat(t.riseFallRate) || 0,
                lastPrice: parseFloat(t.lastPrice) || 0
            }))
            .filter(t => Math.abs(t.riseFallRate * 100) >= minPriceChange && t.volume24 > 100000)
            .sort((a, b) => Math.abs(b.riseFallRate) - Math.abs(a.riseFallRate));
        
        console.log(`📊 Найдено ${filtered.length} контрактов с изменением >= ${minPriceChange}%\n`);
        console.log('═'.repeat(90));
        console.log('Символ'.padEnd(25) + 'Изм. %'.padEnd(25) + 'Объем 24ч'.padEnd(25) + 'Цена');
        console.log('═'.repeat(90));
        
        filtered.slice(0, 30).forEach(contract => {
            const changeEmoji = contract.riseFallRate > 0 ? '🚀' : '💥';
            const changePercent = (contract.riseFallRate * 100).toFixed(2);
            console.log(
                contract.symbol.padEnd(25) +
                `${changeEmoji} ${changePercent}%`.padEnd(25) +
                `$${this.formatVolume(contract.volume24)}`.padEnd(25) +
                `$${contract.lastPrice}`
            );
        });
        
        return filtered;
    }
    
    async findLowCapContracts(minVolume = 100000, maxVolume = 1000000) {
        console.log('\n🔍 Низкокапитализированные фьючерсы...\n');
        
        const tickers = await this.getAllTickers();
        
        const filtered = tickers
            .filter(t => t.symbol && t.volume24)
            .map(t => ({
                symbol: t.symbol,
                volume24: parseFloat(t.volume24) || 0,
                riseFallRate: parseFloat(t.riseFallRate) || 0,
                lastPrice: parseFloat(t.lastPrice) || 0
            }))
            .filter(t => t.volume24 >= minVolume && t.volume24 <= maxVolume)
            .sort((a, b) => b.volume24 - a.volume24);
        
        console.log(`📊 Найдено ${filtered.length} контрактов с объемом $${this.formatVolume(minVolume)} - $${this.formatVolume(maxVolume)}\n`);
        console.log('═'.repeat(90));
        console.log('Символ'.padEnd(25) + 'Объем 24ч'.padEnd(25) + 'Изм. %'.padEnd(20) + 'Цена');
        console.log('═'.repeat(90));
        
        filtered.slice(0, 30).forEach(contract => {
            const changeEmoji = contract.riseFallRate > 0 ? '📈' : contract.riseFallRate < 0 ? '📉' : '➡️';
            const changePercent = (contract.riseFallRate * 100).toFixed(2);
            console.log(
                contract.symbol.padEnd(25) +
                `$${this.formatVolume(contract.volume24)}`.padEnd(25) +
                `${changeEmoji} ${changePercent}%`.padEnd(20) +
                `$${contract.lastPrice}`
            );
        });
        
        return filtered;
    }
    
    async suggestContractsForMonitoring() {
        console.log('\n🎯 РЕКОМЕНДАЦИИ ФЬЮЧЕРСОВ ДЛЯ МОНИТОРИНГА\n');
        console.log('═'.repeat(90));
        
        // 1. Топ по объему
        console.log('\n1️⃣  Топ по объему (ликвидные):');
        const topVolume = await this.findTopVolumeContracts(10);
        
        // 2. Волатильные
        console.log('\n2️⃣  Волатильные (активные движения):');
        const volatile = await this.findHighVolatilityContracts(10);
        
        // 3. Низкокапитализированные
        console.log('\n3️⃣  Низкокапитализированные (легко манипулируются):');
        const lowCap = await this.findLowCapContracts(100000, 500000);
        
        // Генерируем список для config.js
        const suggestions = [
            ...topVolume.slice(0, 3),
            ...volatile.slice(0, 3),
            ...lowCap.slice(0, 4)
        ];
        
        const uniqueSymbols = [...new Set(suggestions.map(c => c.symbol))];
        
        console.log('\n\n✅ ГОТОВЫЙ СПИСОК FUTURES ДЛЯ config.js:\n');
        console.log('symbols: [');
        uniqueSymbols.slice(0, 10).forEach(symbol => {
            console.log(`    '${symbol}',  // Futures`);
        });
        console.log('],\n');
        
        console.log('💡 Совет: Комбинируйте со SPOT парами для полной картины!');
        console.log('Например:');
        console.log('symbols: [');
        console.log("    'BTCUSDT',   // Spot");
        console.log("    'BTC_USDT',  // Futures");
        console.log('],\n');
    }
    
    async compareSpotVsFutures() {
        console.log('\n⚖️  СРАВНЕНИЕ ПОПУЛЯРНЫХ ПАР: SPOT vs FUTURES\n');
        console.log('═'.repeat(90));
        console.log('Пара'.padEnd(20) + 'Spot Объем'.padEnd(25) + 'Futures Объем'.padEnd(25) + 'Разница');
        console.log('═'.repeat(90));
        
        // Здесь можно добавить сравнение, но требуется доступ к Spot API
        console.log('💡 Используйте npm run find для Spot и npm run find:futures для Futures\n');
    }
}

// Запуск
if (require.main === module) {
    const finder = new FuturesSymbolFinder();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'top':
            const limit = parseInt(args[1]) || 30;
            finder.findTopVolumeContracts(limit);
            break;
        case 'volatile':
            const minChange = parseInt(args[1]) || 5;
            finder.findHighVolatilityContracts(minChange);
            break;
        case 'lowcap':
            finder.findLowCapContracts();
            break;
        case 'suggest':
        default:
            finder.suggestContractsForMonitoring();
            break;
    }
}

module.exports = FuturesSymbolFinder;
