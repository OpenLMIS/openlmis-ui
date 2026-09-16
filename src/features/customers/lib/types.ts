export type CustomerPlan = 'Free' | 'Starter' | 'Pro' | 'Enterprise';
export type CustomerStatus = 'Active' | 'Trial' | 'Past Due' | 'Canceled';

export type Customer = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  avatarFallback: string;
  company: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  mrr: number;
  joinedAt: string;
};
