export interface BetConfig {
  currencySymbol: string;
  minBet: string;
  maxBet: string;
  defaultBet: string;
  maxPayout: string;
}

export interface BaseGameConfig {
  commitLength: number;
  commitPattern: string;
  rtp: number;
  decimals: number;
  betConfigs: BetConfig[];
}

export interface GameConfig extends BaseGameConfig {
  minLuckyNumber: number
  maxLuckyNumber: number
  rollOverLowerLimit: number
  rollOverUpperLimit: number
  rollUnderLowerLimit: number
  rollUnderUpperLimit: number
}
