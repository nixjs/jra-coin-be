import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1722320474505 implements MigrationInterface {
    name = 'Migrations1722320474505'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bet" ("turnId" varchar NOT NULL, "userId" varchar NOT NULL, "displayName" varchar, "commitHash" varchar NOT NULL, "maskedResult" varchar NOT NULL, "multiplier" varchar, "signature" varchar, "status" smallint NOT NULL, "direction" smallint, "isWin" smallint, "luckyNumber" smallint NOT NULL, "betNumber" smallint, "betAmount" decimal(23,8), "payout" decimal(23,8), "profit" decimal(23,8), "createdAt" integer NOT NULL, "updatedAt" integer, PRIMARY KEY ("turnId", "createdAt"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "bet"`);
    }

}
