import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenToUser1748288853248 implements MigrationInterface {
  name = 'AddRefreshTokenToUser1748288853248';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "refreshToken" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "refreshToken"`,
    );
  }
}
