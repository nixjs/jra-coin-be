import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1722338269848 implements MigrationInterface {
    name = 'Migrations1722338269848'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bet_result" ("turnId" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "gameSymbol" smallint NOT NULL, "multiplier" decimal NOT NULL, "currencySymbol" varchar NOT NULL, "isWin" boolean NOT NULL, "betAmount" decimal NOT NULL, "payout" decimal NOT NULL, "profit" decimal NOT NULL, "createdAt" integer NOT NULL, "updatedAt" integer)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "bet_result"`);
    }

}
