import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { User } from './entity/User'
import { Item } from './entity/Item'
import { Purchase } from './entity/Purchase'
import { Balance } from './entity/Balance'
import { Transaction } from './entity/Transaction'
import { Bet } from './entity/Bet'
import { BetResult } from './entity/BetResult'
import { Global } from './entity/Global'
import { resolve } from 'path'

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: resolve(__dirname, '../db.sqlite'),
    synchronize: false,
    logging: true,
    entities: [User, Item, Purchase, Global, Balance, Transaction, Bet, BetResult],
    migrations: [resolve(__dirname, '../migrations', '*.{ts,js}')],
    migrationsRun: true,
    subscribers: [],
})
