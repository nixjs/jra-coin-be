import dotenv from 'dotenv'
import { Address } from '@ton/core'
import { Achievement } from './achievements'
import { deployConfig, DeployConfig } from './deploy-config'

dotenv.config()

if (!process.env.JETTON_ADDRESS) {
    throw new Error('JETTON_ADDRESS is not set')
}

if (!process.env.FIRST_TIME_SBT_COLLECTION_ADDRESS) {
    throw new Error('FIRST_TIME_SBT_COLLECTION_ADDRESS is not set')
}

if (!process.env.FIVE_TIMES_SBT_COLLECTION_ADDRESS) {
    throw new Error('FIVE_TIMES_SBT_COLLECTION_ADDRESS is not set')
}

export interface Config extends DeployConfig {
    TOKEN_MINTER: Address
    AMOUNT_CLAIMING_FREE: string
    AMOUNT_CLAIMING_FEE: string
    ACHIEVEMENT_COLLECTION: Record<Achievement, Address>
    DECIMALS: number
}

export const config: Config = {
    ...deployConfig,
    TOKEN_MINTER: Address.parse(process.env.JETTON_ADDRESS),
    AMOUNT_CLAIMING_FREE: String(process.env.AMOUNT_CLAIMING ?? 0),
    AMOUNT_CLAIMING_FEE: String(process.env.AMOUNT_CLAIMING_FEE ?? 0),
    DECIMALS: 8,
    ACHIEVEMENT_COLLECTION: {
        'first-time': Address.parse(process.env.FIRST_TIME_SBT_COLLECTION_ADDRESS),
        'five-times': Address.parse(process.env.FIVE_TIMES_SBT_COLLECTION_ADDRESS),
    },
}
