import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'newuser',
    description: 'Username for the new account',
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password for the new account',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
