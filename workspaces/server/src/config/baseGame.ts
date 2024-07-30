export interface BetConfig {
    currencySymbol: string
    minBet: string
    maxBet: string
    defaultBet: string
    maxPayout: string
}

export interface BaseGameConfig {
    commitLength: number
    commitPattern: string
    rtp: number
    decimals: number
    betConfigs: BetConfig[]
}

const baseGameConfig: BaseGameConfig = {
    commitLength: 128,
    commitPattern: '{{----%s----}}',
    rtp: 98,
    decimals: 8,
    betConfigs: [],
}

export default baseGameConfig
