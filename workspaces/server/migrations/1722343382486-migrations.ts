import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1722343382486 implements MigrationInterface {
    name = 'Migrations1722343382486'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "balance" ("userId" bigint PRIMARY KEY NOT NULL, "total" decimal(23,8) NOT NULL, "createdAt" integer NOT NULL, "updatedAt" integer)`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" varchar NOT NULL, "userId" bigint NOT NULL, "amount" decimal(23,8) NOT NULL, "detailType" integer, "status" integer NOT NULL, "metadata" varchar, "createdAt" integer NOT NULL, "updatedAt" integer, PRIMARY KEY ("id", "createdAt"))`);
        await queryRunner.query(`CREATE TABLE "bet" ("turnId" varchar NOT NULL, "userId" bigint NOT NULL, "displayName" varchar, "commitHash" varchar NOT NULL, "maskedResult" varchar NOT NULL, "multiplier" varchar, "signature" varchar, "status" smallint NOT NULL, "direction" smallint, "isWin" smallint, "luckyNumber" smallint NOT NULL, "betNumber" smallint, "betAmount" decimal(23,8), "payout" decimal(23,8), "profit" decimal(23,8), "createdAt" integer NOT NULL, "updatedAt" integer, PRIMARY KEY ("turnId", "createdAt"))`);
        await queryRunner.query(`CREATE TABLE "bet_result" ("turnId" varchar PRIMARY KEY NOT NULL, "userId" bigint NOT NULL, "gameSymbol" smallint NOT NULL, "multiplier" decimal NOT NULL, "currencySymbol" varchar NOT NULL, "isWin" boolean NOT NULL, "betAmount" decimal NOT NULL, "payout" decimal NOT NULL, "profit" decimal NOT NULL, "createdAt" integer NOT NULL, "updatedAt" integer)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "bet_result"`);
        await queryRunner.query(`DROP TABLE "bet"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TABLE "balance"`);
    }

}
