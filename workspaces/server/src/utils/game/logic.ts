import BigNumber from 'bignumber.js'
import { DiceDirection } from '../../enums/game'
import { BetConfig, GameConfig } from '../../types/game'
import { config } from '../../config/app'
import { toResponse } from '../reponse'

export function onPayout(betNumber: number, direction: DiceDirection, betAmount: string, rtp: number) {
    const winningChance = onWinningChange(betNumber, direction)
    const multiplier = onMultiplier(winningChance, rtp)
    const payout = BigNumber(betAmount).multipliedBy(multiplier).toFixed(config.DECIMALS)
    return { payout, multiplier, winningChance }
}

export function onWinningChange(betNumber: number, direction: DiceDirection): number {
    // + Roll Under: Prediction * 100%
    // + Roll Over: 100 - ( Prediction + 1) * 100%
    if (direction === DiceDirection.ROLL_UNDER) {
        return betNumber
    } else if (direction === DiceDirection.ROLL_OVER) {
        return 100 - (betNumber + 1)
    }
    return 0
}

export function onMultiplier(winningChance: number, rtp: number) {
    //  Multiplier = 98% / Change to win.
    return BigNumber((rtp / 100 / winningChance) * 100).toFixed(4)
}

export function onValidateBetNumber(betNumber: number, direction: DiceDirection, metadata: GameConfig) {
    const { minLuckyNumber, maxLuckyNumber, rollOverUpperLimit, rollOverLowerLimit, rollUnderLowerLimit, rollUnderUpperLimit } = metadata
    if (betNumber < minLuckyNumber || betNumber > maxLuckyNumber)
        return toResponse({ ok: false, error: `betNumber must be inside range [${minLuckyNumber}, ${maxLuckyNumber}]` })
    if (direction === DiceDirection.ROLL_UNDER && (betNumber < rollUnderLowerLimit || betNumber > rollUnderUpperLimit))
        return toResponse({
            ok: false,
            error: `betNumber with direction Under must be inside range [${rollUnderLowerLimit}, ${rollUnderUpperLimit}]`,
        })

    if (direction === DiceDirection.ROLL_OVER && (betNumber < rollOverLowerLimit || betNumber > rollOverUpperLimit))
        return toResponse({
            ok: false,
            error: `betNumber with direction Over must be inside range [${rollOverLowerLimit}, ${rollOverUpperLimit}]`,
        })

    return true
}

export function onValidateBetAmount(betAmount: string, currencySymbol: string, betConfigs: BetConfig[]) {
    const configByCurrencySymbol = betConfigs.find((b) => b.currencySymbol === currencySymbol)
    if (!configByCurrencySymbol) return toResponse({ ok: false, error: 'Game config by currencySymbol not found' })
    const { minBet, maxBet } = configByCurrencySymbol
    const bBetAmount = BigNumber(betAmount)
    if (bBetAmount.isLessThan(minBet) || bBetAmount.isGreaterThan(maxBet))
        return toResponse({ ok: false, error: `betAmount must be inside range [${minBet}, ${maxBet}]` })
}

export function onGetMaxPayoutConfig(currencySymbol: string, betConfigs: BetConfig[]) {
    const config = betConfigs.find((b) => b.currencySymbol === currencySymbol)
    return config?.maxPayout ?? undefined
}
