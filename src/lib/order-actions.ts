import type { OrderDto } from './types';

// OrderResource may omit canCancel. Match the API's cancellable statuses,
// while respecting an explicit restriction from newer API responses.
export function canCancelOrder(order: Pick<OrderDto, 'status' | 'canCancel'>): boolean {
  return order.canCancel !== false && ['draft', 'pending', 'assembling'].includes(order.status);
}
