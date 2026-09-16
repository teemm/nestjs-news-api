import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../auth/dto/auth-response.dto';
import { SafeUser } from '../auth/types/auth.types';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ type: UserDto, isArray: true })
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }
}