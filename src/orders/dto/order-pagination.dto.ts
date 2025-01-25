import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatusList } from '../enum/OrderStatusList';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, {
    message: `status must be one of the following values: ${OrderStatusList}`,
  })
  status?: OrderStatus;
}
