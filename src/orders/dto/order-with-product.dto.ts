export interface OrderWithProductDto {
  OrderItem: {
    productId: number;
    quantity: number;
    price: number;
    name: string;
  }[];
  id: string;
  totalAmount: number;
  totalItems: number;
  status: string;
  paid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
