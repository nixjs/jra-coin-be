import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

//   export enum BetStatus {
//     COMMITTED = 1,
//     BET,
//     COMPLETED,
//   }

//   export enum BetWin {
//     LOSE = 0,
//     WIN,
//   }

// export enum DiceDirection {
//     ROLL_UNDER = 1,
//     ROLL_OVER,
//   }

@Entity()
export class Bet {
    @PrimaryGeneratedColumn('uuid', { name: 'turnId' })
    turnId: string

    @Column({
        nullable: false,
        type: 'bigint',
    })
    userId: number

    @Column({
        nullable: true,
    })
    displayName: string

    @Column()
    commitHash: string

    @Column()
    maskedResult: string

    @Column({
        nullable: true,
    })
    multiplier: string

    @Column({
        nullable: true,
    })
    signature: string

    @Column({
        type: 'smallint',
    })
    status: number

    @Column({
        nullable: true,
        type: 'smallint',
    })
    direction: number

    @Column({
        nullable: true,
        type: 'smallint',
    })
    isWin: number

    @Column({
        type: 'smallint',
    })
    luckyNumber: number

    @Column({
        type: 'smallint',
        nullable: true,
    })
    betNumber: number

    @Column({
        type: 'decimal',
        precision: 23,
        scale: 8,
        nullable: true,
    })
    betAmount: string

    @Column({
        type: 'decimal',
        precision: 23,
        scale: 8,
        nullable: true,
    })
    payout: string

    @Column({
        type: 'decimal',
        precision: 23,
        scale: 8,
        nullable: true,
    })
    profit: string

    @Column({ type: 'int', width: 11, primary: true, update: false })
    createdAt: number

    @Column({ type: 'int', width: 11, nullable: true })
    updatedAt: number

    @BeforeUpdate()
    public setUpdatedAt() {
        this.updatedAt = ~~(Date.now() / 1000)
    }

    @BeforeInsert()
    public setCreatedAt() {
        this.createdAt = ~~(Date.now() / 1000)
    }
}
