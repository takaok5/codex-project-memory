export type SubscriptionStatus = "active" | "suspended" | "expired";

export interface SubscriptionSnapshot {
  userId: string;
  status: SubscriptionStatus;
}

export class SubscriptionService {
  getSubscriptionForUser(userId: string): SubscriptionSnapshot {
    return { userId, status: "active" };
  }

  isSuspended(userId: string): boolean {
    return this.getSubscriptionForUser(userId).status === "suspended";
  }
}
