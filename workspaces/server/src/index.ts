import Fastify from 'fastify'
import cors from '@fastify/cors'
import fetch from 'node-fetch'
import { HttpClient, Api, Transaction as TonApiTransaction } from 'tonapi-sdk-js'
import { Address, Cell, TonClient4, Transaction, fromNano, TonClient, HttpApi } from '@ton/ton'
import { AppDataSource } from './data-source'
import { Executor } from './Executor'
import { GameFiSDK, createHighloadV2 } from '@ton-community/gamefi-sdk'
import { Global } from './entity/Global'
import { In } from 'typeorm'
import { Item } from './entity/Item'
import { Purchase } from './entity/Purchase'
import { Balance } from './entity/Balance'
import { Scheduler } from './Scheduler'
import { User } from './entity/User'
import { config, JETTON_CONTENT_TEMPLATE } from './config/app'
import { getHttpEndpoint, getHttpV4Endpoint } from '@orbs-network/ton-access'
import { processTelegramData } from './telegram'
import { boolean, string, z } from 'zod'
import { toResponse } from './utils/reponse'
import BigNumber from 'bignumber.js'
import { ResponseData } from './types/reponse'
import gameConfig, { baseInitBet } from './config/game'
import { BetStatus, BetWin, DiceDirection, GameSymbol } from './enums/game'
import { generateCommitHash, randomNumber } from './utils/randomize'
import { Bet } from './entity/Bet'
import { BetConfig } from './types/game'
import { onGetMaxPayoutConfig, onPayout, onValidateBetAmount, onValidateBetNumber } from './utils/game/logic'
import { BetResult } from './entity/BetResult'
import { Transaction as ITransaction } from './entity/Transaction'
import { TransactionStatus, TransactionType } from './enums/transaction'

const PROCESS_INTERVAL = 10000
const { NETWORK, TOKEN_MINTER, ACHIEVEMENT_COLLECTION, AMOUNT_CLAIMING_FEE, AMOUNT_CLAIMING_FREE, DECIMALS } = config

const userRequest = z.object({
    tg_data: z.string(),
})

const initRequest = z
    .object({
        wallet: z.string().optional(),
    })
    .merge(userRequest)

const playedRequest = z
    .object({
        score: z.number().int(),
        wallet: z.string().optional(),
    })
    .merge(userRequest)

const placeBetRequest = z
    .object({
        betAmount: z.string(),
        betNumber: z.number(),
        // currencySymbol: z.string(),
        direction: z.number(),
        turnId: z.string(),
    })
    .merge(userRequest)

const claimingRequest = z
    .object({
        hash: z.string(),
        msgHash: z.string().optional(),
        wallet: z.string().optional(),
    })
    .merge(userRequest)

const resultsRequest = z.object({
    page: z.string(),
    size: z.string(),
})

const tonApiHttpClient = new HttpClient({
    baseUrl: NETWORK === 'mainnet' ? 'https://tonapi.io' : 'https://testnet.tonapi.io',
    baseApiParams: {
        headers: {
            Authorization: `Bearer AFX2NKWILKM6DFQAAAAGFSNQ2ZUHXCUEGIYUZWQZT4QNHYW4NIVOOM54NHGVQVRYWHZJZHA`,
            'Content-type': 'application/json',
        },
    },
})
const tonApiClient = new Api(tonApiHttpClient)

async function getTxById(hash: string) {
    try {
        return await tonApiClient.blockchain.getBlockchainTransaction(hash)
    } catch (error) {
        return null
    }
}

async function getTxByMsgHash(hash: string) {
    try {
        return await tonApiClient.blockchain.getBlockchainTransactionByMessageHash(hash)
    } catch (error) {
        return null
    }
}

function parseTransferNotification(cell: Cell): {
    queryId: bigint
    amount: bigint
    sender: Address
    forwardPayload: Cell
} {
    const s = cell.beginParse()
    if (s.loadUint(32) !== 0x7362d09c) {
        throw new Error('Invalid opcode')
    }
    return {
        queryId: s.loadUintBig(64),
        amount: s.loadCoins(),
        sender: s.loadAddress(),
        forwardPayload: s.loadBoolean() ? s.loadRef() : s.asCell(),
    }
}

function parsePurchaseRequest(tx: Transaction, acceptFrom: Address) {
    try {
        if (!tx.inMessage) throw new Error('No message')
        if (!(tx.inMessage.info.src instanceof Address) || !tx.inMessage.info.src.equals(acceptFrom)) throw new Error('Invalid sender')
        const parsed = parseTransferNotification(tx.inMessage.body)
        const fs = parsed.forwardPayload.beginParse()
        const op = fs.loadUint(32)
        if (op !== 0) throw new Error('Invalid opcode')
        const msg = fs.loadStringTail()
        const parts = msg.split(':')
        if (parts.length !== 2) {
            throw new Error('Invalid message')
        }
        return {
            userId: Number(parts[0]),
            itemID: Number(parts[1]),
            amount: parsed.amount,
            hash: tx.hash(),
            lt: tx.lt,
        }
    } catch (e) {}
    return undefined
}

type PurchaseRequest = { userId: number; itemID: number; amount: bigint; hash: Buffer; lt: bigint }

async function findPurchaseRequests(
    client: TonClient4,
    address: Address,
    acceptFrom: Address,
    from: { hash: Buffer; lt: bigint },
    known?: { hash: Buffer; lt: bigint }
): Promise<PurchaseRequest[]> {
    const prs: PurchaseRequest[] = []
    let curHash = from.hash
    let curLt = from.lt
    let first = true
    mainLoop: while (true) {
        const txs = await client.getAccountTransactions(address, curLt, curHash)
        if (first) {
            first = false
        } else {
            txs.shift()
            if (txs.length === 0) break
        }
        for (const tx of txs) {
            if (known !== undefined && tx.tx.hash().equals(known.hash) && tx.tx.lt === known.lt) break mainLoop
            const pr = parsePurchaseRequest(tx.tx, acceptFrom)
            if (pr !== undefined) prs.push(pr)
        }
        curHash = txs[txs.length - 1].tx.hash()
        curLt = txs[txs.length - 1].tx.lt
    }
    return prs
}

function sleep(timeout: number): Promise<void> {
    return new Promise((res) => {
        setTimeout(() => res(), timeout)
    })
}

async function processTxsForever(address: Address, client: TonClient4, acceptFrom: Address, known?: { hash: Buffer; lt: bigint }) {
    while (true) {
        await sleep(PROCESS_INTERVAL)
        known = await processTxs(address, client, acceptFrom, known)
    }
}

async function processTxs(
    address: Address,
    client: TonClient4,
    acceptFrom: Address,
    known?: { hash: Buffer; lt: bigint }
): Promise<{ hash: Buffer; lt: bigint } | undefined> {
    try {
        const lastBlock = await client.getLastBlock()
        const acc = await client.getAccountLite(lastBlock.last.seqno, address)
        if (acc.account.last === null) return undefined
        if (known !== undefined && acc.account.last.hash === known.hash.toString('base64') && acc.account.last.lt === known.lt.toString())
            return known
        const newKnown = {
            hash: Buffer.from(acc.account.last.hash, 'base64'),
            lt: BigInt(acc.account.last.lt),
        }
        let purchaseRequests: { userId: number; itemID: number; amount: bigint; hash: Buffer; lt: bigint }[] = await findPurchaseRequests(
            client,
            address,
            acceptFrom,
            newKnown,
            known
        )
        const itemIDs = Array.from(new Set(purchaseRequests.map((p) => p.itemID)))
        const items = await AppDataSource.getRepository(Item).find({
            where: {
                id: In(itemIDs),
            },
        })
        const itemsMap = new Map(items.map((it) => [it.id, it]))
        purchaseRequests = purchaseRequests.filter((pr) => {
            const it = itemsMap.get(pr.itemID)
            return it !== undefined && pr.amount >= it.cost
        })
        await Promise.allSettled(
            purchaseRequests.map((it) =>
                AppDataSource.getRepository(Purchase)
                    .createQueryBuilder()
                    .insert()
                    .values({
                        user: { id: it.userId },
                        item: { id: it.itemID },
                        txHash: it.hash.toString('base64'),
                        txLt: it.lt.toString(),
                    })
                    .orIgnore()
                    .execute()
            )
        )
        await AppDataSource.getRepository(Global)
            .createQueryBuilder()
            .insert()
            .values({
                key: 'last_known_tx',
                value: newKnown.hash.toString('base64') + ':' + newKnown.lt.toString(),
            })
            .orUpdate(['value'], ['key'])
            .execute()
        return newKnown
    } catch (e) {
        return known
    }
}

async function main() {
    await AppDataSource.initialize()

    async function adjustBalance(
        userId: number,
        currencySymbol: string,
        total: string,
        available: string,
        debit: boolean
    ): Promise<ResponseData<Balance>> {
        let balanceInDb = await AppDataSource.getRepository(Balance).findOne({
            where: {
                userId,
            },
        })
        if (!balanceInDb) return toResponse({ ok: false, error: 'insufficient account' })

        let bTotal = BigNumber(balanceInDb.total)

        if (debit) {
            if (bTotal.isLessThan(total)) return toResponse({ ok: false, error: 'insufficient account' })
        }

        bTotal = debit ? bTotal.minus(total) : bTotal.plus(total)

        const pTotal = bTotal.toFixed(DECIMALS)
        await AppDataSource.getRepository(Balance).update(
            { userId },
            {
                total: pTotal,
                updatedAt: ~~(Date.now() / 1000),
            }
        )
        const uBalance = await AppDataSource.getRepository(Balance).findOne({ where: { userId } })
        if (uBalance) {
            await AppDataSource.getRepository(ITransaction).create({
                type: debit ? TransactionType.DEBIT : TransactionType.CREDIT,
                userId,
                amount: available,
                currencySymbol,
                status: TransactionStatus.SUCCESSFUL,
            } as any)
            return toResponse({ ok: true, result: uBalance })
        }

        return toResponse({ ok: false, error: 'insufficient account' })
    }

    const highload = await createHighloadV2(config.MNEMONIC!)

    const sdk = await GameFiSDK.create({
        api: NETWORK,
        wallet: highload,
        storage: {
            pinataApiKey: config.PINATA_API_KEY!,
            pinataSecretKey: config.PINATA_SECRET!,
        },
    })

    const executor = new Executor(sdk, highload.wallet, highload.keyPair.secretKey)
    const scheduler = new Scheduler(executor)

    const fastify = Fastify({
        logger: true,
    })

    // if (config.CORS_ENABLED) {
    //     fastify.register(cors, {
    //         origin: config.CORS_ORIGIN!,
    //     });
    // }

    fastify.register(cors, {
        origin: '*',
    })

    // you could implement proxy like this using static server like Nginx, Caddy, etc.
    fastify.get('/fix-cors', async (request, reply) => {
        const url = (request.query as Record<string, string | undefined>)['url']

        if (!url) {
            reply.status(400).send({ error: 'URL parameter is required.' })
            return
        }

        try {
            const response = await fetch(url)
            const body = await response.text()

            // Forward the response headers and status code from the proxied request
            reply.headers(response.headers.raw())
            reply.status(response.status).send(body)
        } catch (error) {
            fastify.log.error(error)
            reply.status(500).send({ error: 'Failed to proxy request.' })
        }
    })

    // fastify.post('/played', async function handler(request, _reply) {
    //     const req = playedRequest.parse(request.body)

    //     let reqWallet: Address | undefined = undefined
    //     if (req.wallet !== undefined) {
    //         try {
    //             reqWallet = Address.parse(req.wallet)
    //         } catch (e) {}
    //     }

    //     const telegramData = processTelegramData(req.tg_data, config.TELEGRAM_BOT_TOKEN!)

    //     if (!telegramData.ok) return { ok: false }

    //     const parsedUser = JSON.parse(telegramData.data.user)
    //     const userId: number = parsedUser.id

    //     const result: { ok: false } | { ok: true; plays: number; previousHighScore?: number; wallet: string } =
    //         await AppDataSource.transaction(async (tx) => {
    //             const user = await tx.findOneBy(User, { id: userId })
    //             if (user === null) {
    //                 if (reqWallet === undefined) return { ok: false }
    //                 const newUser = new User()
    //                 newUser.highScore = req.score
    //                 newUser.id = userId
    //                 newUser.wallet = reqWallet.toString({
    //                     urlSafe: true,
    //                     bounceable: false,
    //                     testOnly: false,
    //                 })
    //                 newUser.plays = 1
    //                 await tx.save(newUser)
    //                 return { ok: true, plays: newUser.plays, wallet: newUser.wallet }
    //             } else {
    //                 user.plays++
    //                 if (reqWallet !== undefined) {
    //                     user.wallet = reqWallet.toString({
    //                         urlSafe: true,
    //                         bounceable: false,
    //                         testOnly: false,
    //                     })
    //                 }
    //                 let previousHighScore: number | undefined = undefined
    //                 if (req.score > user.highScore) {
    //                     previousHighScore = user.highScore
    //                     user.highScore = req.score
    //                 }
    //                 await tx.save(user)
    //                 return { ok: true, plays: user.plays, previousHighScore, wallet: user.wallet }
    //             }
    //         })

    //     if (!result.ok) return { ok: false }

    //     let rewardTokens = 1
    //     const prevTen = Math.floor((result.previousHighScore ?? 0) / 10)
    //     const newTen = Math.floor(req.score / 10)
    //     if (newTen > prevTen) {
    //         rewardTokens += (newTen - prevTen) * 10
    //     }

    //     const newAchievements: Achievement[] = []
    //     if (result.plays === 1) {
    //         newAchievements.push('first-time')
    //     } else if (result.plays === 5) {
    //         newAchievements.push('five-times')
    //     }

    //     const recipient = Address.parse(result.wallet)
    //     for (const ach of newAchievements) {
    //         scheduler.schedule({
    //             type: 'sbt',
    //             collection: ACHIEVEMENT_COLLECTION[ach],
    //             owner: recipient,
    //         })
    //     }
    //     scheduler.schedule({
    //         type: 'jetton',
    //         to: recipient,
    //         amount: BigInt(rewardTokens),
    //         minter: TOKEN_MINTER,
    //     })

    //     return toResponse({
    //         ok: true,
    //         result: { reward: rewardTokens, achievements: newAchievements },
    //     })
    // })

    fastify.get('/config', async function handler(_request, _reply) {
        const tokenMinterAddress = TOKEN_MINTER.toString({ testOnly: NETWORK === 'testnet' })
        const achievementCollection = Object.fromEntries(
            Object.entries(ACHIEVEMENT_COLLECTION).map(([k, v]) => [k, v.toString({ testOnly: NETWORK === 'testnet' })])
        )

        const acceptFrom = sdk.sender?.address!
        const tokenRecipient = acceptFrom.toString({ testOnly: NETWORK === 'testnet' })

        return toResponse({
            ok: true,
            result: {
                network: NETWORK,
                contractAddress: tokenMinterAddress,
                ownerAddress: tokenRecipient,
                achievementCollection: achievementCollection,
                amountClaiming: AMOUNT_CLAIMING_FREE,
                claimingFee: AMOUNT_CLAIMING_FEE,
            },
        })
    })

    fastify.post('/init', async function handler(request, _reply) {
        const { tg_data, wallet } = initRequest.parse(request.body)

        let reqWallet: Address | undefined = undefined
        if (wallet !== undefined) {
            try {
                reqWallet = Address.parse(wallet)
            } catch (e) {}
        }

        const telegramData = processTelegramData(tg_data, config.TELEGRAM_BOT_TOKEN!)

        if (!telegramData.ok) return { ok: false }

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId: number = parsedUser.id

        const result: ResponseData<undefined> = await AppDataSource.transaction(async (tx) => {
            const user = await tx.findOneBy(User, { id: userId })
            let status = false
            if (user === null) {
                if (reqWallet === undefined) status = false
                else {
                    const newUser = new User()
                    newUser.highScore = 0
                    newUser.id = userId
                    newUser.wallet = reqWallet.toString({
                        urlSafe: true,
                        bounceable: false,
                        testOnly: false,
                    })
                    newUser.plays = 1
                    await tx.save(newUser)
                    status = true
                }
            }
            return toResponse({ ok: status })
        })

        return result
    })

    fastify.post('/claim', async function handler(request, _reply) {
        const { hash, tg_data, msgHash, wallet } = claimingRequest.parse(request.body)

        let reqWallet: Address | undefined = undefined
        if (wallet !== undefined) {
            try {
                reqWallet = Address.parse(wallet)
            } catch (e) {}
        }
        if (!reqWallet)
            return toResponse({
                ok: false,
                error: 'wallet in valid',
            })
        const endpoint = await (async () =>
            await getHttpEndpoint({
                network: NETWORK,
            }))()

        const tonClient = new TonClient({
            endpoint,
        })
        const reqWalletBalance = await tonClient.getBalance(reqWallet)
        const dReqWalletBalance = BigNumber(reqWalletBalance.toString())
        if (dReqWalletBalance.isNaN() || dReqWalletBalance.isLessThanOrEqualTo(AMOUNT_CLAIMING_FEE))
            return toResponse({
                ok: false,
                error: 'insufficient account',
            })

        const hashLg = Number(hash.length)
        const msgHashLg = Number(msgHash?.length)
        if (hashLg === 0 && msgHashLg === 0) {
            return toResponse({
                ok: false,
                error: 'tx not found',
            })
        }

        const telegramData = processTelegramData(tg_data, config.TELEGRAM_BOT_TOKEN!)
        if (!telegramData.ok)
            return toResponse({
                ok: false,
                error: 'telegram data invalid',
            })

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId: number = parsedUser.id
        const user = await AppDataSource.getRepository(User).findOneBy({
            id: userId,
        })
        if (!user)
            return toResponse({
                ok: false,
                error: 'user not found',
            })

        if (wallet) {
            let info: TonApiTransaction | null = null
            if (hashLg > 0) info = await getTxById(hash)
            else if (msgHash && msgHashLg > 0) info = await getTxByMsgHash(msgHash)

            if (!info?.success)
                return toResponse({
                    ok: false,
                    error: 'tx not found',
                })
            const msgInfo = info?.out_msgs?.[0]

            if (msgInfo) {
                const { destination, value, source } = msgInfo
                if (
                    destination?.address &&
                    sdk?.sender?.address &&
                    source?.address &&
                    user?.wallet &&
                    !user?.isClaimed &&
                    Address.parseRaw(destination?.address).equals(sdk?.sender?.address) &&
                    reqWallet.equals(Address.parseRaw(source?.address)) &&
                    reqWallet.equals(Address.parse(user?.wallet)) &&
                    BigNumber(fromNano(value)).isGreaterThanOrEqualTo(AMOUNT_CLAIMING_FEE)
                ) {
                    const uResult = await AppDataSource.getRepository(User).save({
                        ...user,
                        isClaimed: 1,
                    })
                    const bResult: { ok: false } | { ok: true } = await AppDataSource.transaction(async (tx) => {
                        const balance = await tx.findOneBy(Balance, { userId: userId })
                        if (balance === null) {
                            if (reqWallet === undefined) return { ok: false }
                            const newUser = new Balance()
                            newUser.userId = userId
                            newUser.total = config.AMOUNT_CLAIMING_FREE
                            await tx.save(newUser)
                            return { ok: true }
                        } else {
                            let dTotal = BigNumber(balance.total).isNaN() ? BigNumber(0) : BigNumber(balance.total)
                            balance.total = dTotal.plus(config.AMOUNT_CLAIMING_FEE).toFixed(DECIMALS)
                            await tx.save(user)
                            return { ok: true }
                        }
                    })
                    if (uResult && bResult) {
                        scheduler.schedule({
                            type: 'jetton',
                            to: reqWallet,
                            amount: BigInt(config.AMOUNT_CLAIMING_FREE),
                            minter: TOKEN_MINTER,
                        })
                        return toResponse({
                            ok: true,
                            result: {
                                claimed: config.AMOUNT_CLAIMING_FREE,
                            },
                        })
                    }
                }
            }
        }
        return toResponse({
            ok: false,
            error: 'Failed to claim',
        })
    })

    fastify.post('/balance', async function handler(request, _reply) {
        const { tg_data } = userRequest.parse(request.body)

        const telegramData = processTelegramData(tg_data, config.TELEGRAM_BOT_TOKEN!)
        if (!telegramData.ok) return { ok: false }

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId: number = parsedUser.id

        const balance = await AppDataSource.getRepository(Balance).findOneBy({ userId })
        if (!balance) return toResponse({ ok: false, error: 'balance not found' })
        const userInfo = await AppDataSource.getRepository(User).findOneBy({ id: userId })

        return toResponse({
            ok: true,
            result: { ...balance, claimed: !!userInfo?.isClaimed },
        })
    })

    fastify.get('/game-config', async function handler(_request, _reply) {
        return toResponse({
            ok: true,
            result: gameConfig,
        })
    })

    fastify.post('/new-turn', async function handler(request, _reply) {
        const { tg_data } = userRequest.parse(request.body)

        const telegramData = processTelegramData(tg_data, config.TELEGRAM_BOT_TOKEN!)

        if (!telegramData.ok) return { ok: false }

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId: number = parsedUser.id

        const bLatest = await AppDataSource.getRepository(Bet).findOne({
            where: {
                userId,
                status: BetStatus.COMMITTED,
            },
            order: {
                updatedAt: 'DESC',
            },
        })

        if (bLatest?.turnId && bLatest.status === BetStatus.COMMITTED && bLatest.commitHash && bLatest.maskedResult) {
            return toResponse({
                ok: true,
                result: {
                    turnId: bLatest?.turnId,
                    commitHashInfo: {
                        commitHash: bLatest.commitHash,
                    },
                },
            })
        }

        const { minLuckyNumber, maxLuckyNumber, commitLength, commitPattern } = gameConfig
        const luckyNumber = randomNumber(minLuckyNumber, maxLuckyNumber)
        const { commitHash, maskedResult } = generateCommitHash(luckyNumber.toString(), commitLength, commitPattern)
        const betRepository = AppDataSource.getRepository(Bet)
        const bet = new Bet()
        bet.commitHash = commitHash
        bet.luckyNumber = luckyNumber
        bet.maskedResult = maskedResult
        bet.status = BetStatus.COMMITTED
        bet.userId = userId
        const dBet = await betRepository.save(bet)

        if (!dBet) return toResponse({ ok: false, error: 'Failed to create new turn' })
        return toResponse({
            ok: true,
            result: { turnId: dBet.turnId, commitHashInfo: { commitHash } },
        })
    })

    fastify.post('/place-bet', async function handler(request, _reply) {
        const { betAmount, betNumber, direction, tg_data, turnId } = placeBetRequest.parse(request.body)
        const currencySymbol = JETTON_CONTENT_TEMPLATE.symbol

        const telegramData = processTelegramData(tg_data, config.TELEGRAM_BOT_TOKEN!)

        if (!telegramData.ok) return { ok: false }

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId = parsedUser.id

        if (!userId) return toResponse({ ok: false, result: 'User not found' })

        if (!turnId || Number(turnId?.length) === 0) return toResponse({ ok: false, result: 'Turn id invalid' })

        if (!betNumber) return toResponse({ ok: false, result: 'betNumber invalid' })

        const turnInfo = await AppDataSource.getRepository(Bet).findOne({
            where: {
                turnId,
            },
        })
        if (!turnInfo) return toResponse({ ok: false, result: 'Turn info invalid' })

        const { betConfigs, rtp } = gameConfig

        onValidateBetAmount(betAmount, currencySymbol, betConfigs)
        onValidateBetNumber(Number(betNumber), direction, gameConfig)

        const { luckyNumber, userId: dbUserId, createdAt, status } = turnInfo
        if (userId !== dbUserId) return toResponse({ ok: false, result: 'User id invalid' })

        if (status !== BetStatus.COMMITTED) return toResponse({ ok: false, result: 'Bet info invalid' })

        // check balance
        const balanceInDb = await AppDataSource.getRepository(Balance).findOne({
            where: {
                userId,
            },
        })
        const availableInDb = BigNumber(balanceInDb?.total ?? '0')
        if (availableInDb.isZero() || availableInDb.isLessThan(betAmount)) return toResponse({ ok: false, result: 'Insufficient balance' })

        let isWin = false
        let multiplier = null
        let payout = '0'
        let profit = '0'

        if (direction === DiceDirection.ROLL_UNDER) {
            if (luckyNumber < betNumber) {
                isWin = true
            }
        } else if (direction === DiceDirection.ROLL_OVER) {
            if (luckyNumber > betNumber) {
                isWin = true
            }
        }

        const maxPayoutConfig = onGetMaxPayoutConfig(currencySymbol, betConfigs) ?? '0'
        const payoutCalculator = onPayout(betNumber, direction, betAmount, Number(rtp))
        multiplier = payoutCalculator.multiplier
        if (isWin) {
            payout = BigNumber(payoutCalculator.payout).isLessThanOrEqualTo(maxPayoutConfig) ? payoutCalculator.payout : maxPayoutConfig
            profit = BigNumber(payout).minus(betAmount).toFixed(DECIMALS) as string
        }
        // update balance
        const totalAmount = isWin ? payout : betAmount
        await adjustBalance(userId, currencySymbol, totalAmount, totalAmount, !isWin)

        const betRepository = AppDataSource.getRepository(Bet)

        const fBet = await betRepository.findOne({
            where: {
                turnId,
                createdAt,
            },
        })
        if (fBet) {
            Object.assign(fBet, {
                userId,
                displayName: '',
                multiplier,
                status: BetStatus.COMPLETED,
                direction,
                isWin: isWin ? BetWin.WIN : BetWin.LOSE,
                luckyNumber,
                betNumber,
                betAmount,
                payout,
                profit,
                updatedAt: ~~(Date.now() / 1000),
            })
            await betRepository.save(fBet)

            const betResultRepository = AppDataSource.getRepository(BetResult)
            const betResult = new BetResult()
            betResult.turnId = turnId
            betResult.userId = userId
            betResult.betAmount = betAmount
            betResult.currencySymbol = currencySymbol
            betResult.gameSymbol = GameSymbol.DICE
            betResult.isWin = isWin
            betResult.multiplier = multiplier
            betResult.payout = payout
            betResult.profit = profit
            await betResultRepository.save(betResult)

            const bResult = await betRepository.findOne({
                where: {
                    turnId,
                    createdAt,
                },
            })

            return toResponse({
                ok: true,
                result: bResult,
            })
        }
        return toResponse({
            ok: false,
            error: 'Failed to place bet',
        })
    })

    fastify.get('/results', async function handler(request, _reply) {
        const { page, size } = resultsRequest.parse(request.query)
        const result = await AppDataSource.getRepository(BetResult).findAndCount({ take: Number(size), skip: Number(page) })
        return toResponse({
            ok: true,
            result: {
                data: result[0],
                total: result[1],
            },
        })
    })

    /**
     * @deprecated
     */
    fastify.get('/purchases', async function handler(request, reply) {
        const telegramData = processTelegramData((request.query as any).auth, config.TELEGRAM_BOT_TOKEN!)

        if (!telegramData.ok) return { ok: false }

        const parsedUser = JSON.parse(telegramData.data.user)
        const userId: number = parsedUser.id

        const purchases = await AppDataSource.getRepository(Purchase).find({
            where: {
                user: { id: userId },
            },
            relations: {
                item: true,
            },
        })

        const result = purchases.map((p) => ({ itemID: p.item.id, name: p.item.name, systemName: p.item.systemName, type: p.item.type }))

        return { ok: true, purchases: result }
    })

    let known: { hash: Buffer; lt: bigint } | undefined = undefined
    const knownDb = await AppDataSource.getRepository(Global).findOneBy({
        key: 'last_known_tx',
    })
    if (knownDb !== null) {
        const parts = knownDb.value.split(':')
        known = {
            hash: Buffer.from(parts[0], 'base64'),
            lt: BigInt(parts[1]),
        }
    }
    const client = new TonClient4({
        endpoint: await getHttpV4Endpoint({ network: NETWORK }),
    })
    const acceptFrom = await sdk.openJetton(TOKEN_MINTER).getWalletAddress(sdk.sender?.address!)

    processTxsForever(sdk.sender?.address!, client, acceptFrom, known)

    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' })
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}

main()
