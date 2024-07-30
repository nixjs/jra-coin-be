import { Entity, Column, PrimaryColumn, BeforeUpdate, BeforeInsert } from 'typeorm'

@Entity()
export class Balance {
    @PrimaryColumn({
        primary: true,
        nullable: false,
        type: 'bigint',
    })
    userId: number

    @Column({
        type: 'decimal',
        precision: 23,
        scale: 8,
    })
    total: string

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
