import { SubscriptionService } from "../subscriptions/subscription.service";
import { AuditService } from "../audit/audit.service";

export interface AccessRequest {
  userId: string;
  gateId: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export class AccessService {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService
  ) {}

  canOpen(request: AccessRequest): AccessDecision {
    const subscription = this.subscriptions.getSubscriptionForUser(request.userId);
    if (subscription.status !== "active") {
      return { allowed: false, reason: "subscription_not_active" };
    }
    this.audit.recordAccessCheck(request.userId, request.gateId, true);
    return { allowed: true, reason: "ok" };
  }
}
