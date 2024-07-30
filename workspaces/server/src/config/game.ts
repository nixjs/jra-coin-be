import { GameConfig } from '../types/game'
import { JETTON_CONTENT_TEMPLATE } from './app'
import baseGameConfig from './baseGame'

const gameConfig: GameConfig = {
    ...baseGameConfig,
    minLuckyNumber: 0,
    maxLuckyNumber: 99,
    rollOverLowerLimit: 4,
    rollOverUpperLimit: 98,
    rollUnderLowerLimit: 1,
    rollUnderUpperLimit: 95,
    betConfigs: [
        {
            currencySymbol: JETTON_CONTENT_TEMPLATE.symbol,
            maxBet: '3000',
            minBet: '100',
            maxPayout: '73500',
            defaultBet: '100',
        },
    ],
}

export const baseInitBet = {
    betAmount: null,
    currencySymbol: null,
    multiplier: null,
    direction: null,
    isWin: null,
    payout: null,
    profit: null,
    betNumber: null,
    displayName: null,
}

export default gameConfig
