import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  Req,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

function toSafeUser(user: User): Omit<User, 'password' | 'refreshToken'> {
  return { id: user.id, username: user.username };
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users returned',
    schema: {
      example: [
        { id: 1, username: 'user1' },
        { id: 2, username: 'user2' },
      ],
    },
  })
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(toSafeUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'User returned',
    schema: {
      example: { id: 1, username: 'user1' },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toSafeUser(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'updateduser' },
        password: { type: 'string', example: 'newpassword123' },
      },
      required: ['username', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      example: { id: 1, username: 'updateduser' },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Cannot update another user's account",
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body('username') username: string,
    @Body('password') password: string,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own account');
    }
    const user = await this.usersService.update(id, username, password);
    return toSafeUser(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      example: { message: 'User deleted successfully' },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Cannot delete another user's account",
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only delete your own account');
    }
    return this.usersService.remove(id);
  }
}
