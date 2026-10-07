import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from '../dto';
import { TasksService } from '../service/tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Permissions(PERMISSIONS.TASK.READ)
  list(@CurrentTenant() organisationId: string, @Query() query: ListTasksQueryDto) {
    return this.tasksService.list(organisationId, query);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.TASK.READ)
  getById(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.tasksService.getById(organisationId, id);
  }

  @Post()
  @Permissions(PERMISSIONS.TASK.CREATE)
  create(
    @CurrentTenant() organisationId: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.TASK.UPDATE)
  update(@CurrentTenant() organisationId: string, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(organisationId, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.TASK.DELETE)
  remove(@CurrentTenant() organisationId: string, @Param('id') id: string) {
    return this.tasksService.remove(organisationId, id);
  }
}
