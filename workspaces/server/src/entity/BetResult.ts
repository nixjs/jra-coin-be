import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryColumn } from 'typeorm'

@Entity()
export class BetResult {
    @PrimaryColumn()
    turnId: string

    @Column({
        type: 'bigint',
    })
    userId: number

    @Column({
        type: 'smallint',
    })
    gameSymbol: number

    @Column({
        type: 'decimal',
    })
    multiplier: string
    @Column()
    currencySymbol: string

    @Column()
    isWin: boolean

    @Column({
        type: 'decimal',
    })
    betAmount: string

    @Column({
        type: 'decimal',
    })
    payout: string

    @Column({
        type: 'decimal',
    })
    profit: string

    @Column({ type: 'int', width: 11, update: false })
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
