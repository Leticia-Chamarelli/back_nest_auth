import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1748288000000 implements MigrationInterface {
  name = 'CreateUserTable1748288000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" SERIAL PRIMARY KEY,
        "username" character varying NOT NULL,
        "password" character varying NOT NULL,
        "refreshToken" text,
        CONSTRAINT "UQ_user_username" UNIQUE ("username")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }
}
