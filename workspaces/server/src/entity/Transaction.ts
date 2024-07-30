import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

// export enum TransactionDetailType {
//     'DEPOSIT', 0
//     'WITHDRAW', 1
// }

// export enum TransactionStatus {
//     'REQUESTED',   0
//     'PROCESSING',  1
//     'SUCCESSFUL',  2
//     'FAILED',      3
//     'REFUNDED',    4
// }

@Entity({ name: 'transactions' })
export class Transaction {
    @PrimaryGeneratedColumn('uuid', { name: 'id' })
    id: string

    @Column({
        nullable: false,
        type: 'bigint',
    })
    userId: number

    @Column({
        type: 'decimal',
        precision: 23,
        scale: 8,
    })
    amount: string

    @Column({
        nullable: true,
    })
    detailType: number

    @Column()
    status: number

    @Column({
        type: 'varchar',
        nullable: true,
    })
    metadata: any

    @Column({ type: 'int', width: 11, update: false, primary: true })
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
