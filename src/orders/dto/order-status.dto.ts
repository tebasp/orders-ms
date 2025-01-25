import { OrderStatus } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatusList } from '../enum/OrderStatusList';

export class OrderStatusDto {
  @IsUUID(4)
  id: string;

  @IsEnum(OrderStatus, {
    message: `status must be one of the following values: ${OrderStatusList}`,
  })
  status: OrderStatus;
}
