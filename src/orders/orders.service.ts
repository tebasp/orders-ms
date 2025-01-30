import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { OrderStatusDto } from './dto/order-status.dto';
import { NATS_SERVICE } from '../config/service-tokens';
import { firstValueFrom } from 'rxjs';
import { OrderWithProductDto } from './dto/order-with-product.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private logger = new Logger('OrdersService');

  constructor(
    @Inject(NATS_SERVICE)
    private readonly _natsService: ClientProxy,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the OrdersDB database');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const productsIds: number[] = createOrderDto.items.map((item) => item.id);

      const products = await firstValueFrom(
        this._natsService.send('validate_products', productsIds),
      );

      const totalAmount = createOrderDto?.items?.reduce((acc, item) => {
        const price = products?.find((p) => p.id === item.id)?.price;
        return acc + price * item?.quantity;
      }, 0);

      const totalItems = createOrderDto?.items?.reduce((acc, item) => {
        return acc + item?.quantity;
      }, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto?.items?.map((item) => ({
                name: products?.find((p) => p?.id === item?.id)?.name,
                productId: item?.id,
                price: products?.find((p) => p?.id === item?.id)?.price,
                quantity: item?.quantity,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              name: true,
              productId: true,
              quantity: true,
              price: true,
            },
          },
        },
      });

      return order;
    } catch (e) {
      this.logger.log('Error', e);

      throw new RpcException({
        message: `Could not create the order ${e?.message}`,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    try {
      const { page, limit } = orderPaginationDto;

      const total = await this.order.count({
        where: {
          status: orderPaginationDto?.status,
        },
      });

      const orders = await this.order.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          status: orderPaginationDto?.status,
        },
      });

      return {
        data: orders,
        meta: {
          total,
          currentPage: page,
          lastPage: Math.ceil(total / limit),
        },
      };
    } catch (e) {
      throw new RpcException({
        message: `Could not find orders ${e?.message}`,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  async findOne(id: string) {
    try {
      const order = await this.order.findUnique({
        where: { id },
        include: {
          OrderItem: {
            select: {
              productId: true,
              price: true,
              quantity: true,
            },
          },
        },
      });

      if (!order) {
        throw new RpcException({
          message: `Order with id ${id} not found`,
          status: HttpStatus.NOT_FOUND,
        });
      }

      const productIds = order.OrderItem?.map((item) => item.productId);

      const products = await firstValueFrom(
        this._natsService.send('validate_products', productIds),
      );

      console.log('products', products);

      return {
        ...order,
        OrderItem: order.OrderItem?.map((item) => ({
          ...item,
          name: products?.find((p) => p.id === item.productId)?.name,
        })),
      };
    } catch (e) {
      throw e;
    }
  }

  async changeOrderStatus(orderStatusDto: OrderStatusDto) {
    const { id, status } = orderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status },
    });
  }

  async createPaymentSession(order: OrderWithProductDto) {
    try {
      const paymentSession = await firstValueFrom(
        this._natsService.send('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.OrderItem.map((item) => ({
            name: item?.name,
            price: item?.price,
            quantity: item?.quantity,
          })),
        }),
      );

      return paymentSession;
    } catch (e) {
      console.log('Error', e);

      throw new RpcException({
        message: `Could not create the payment session ${e?.message}`,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }
}
