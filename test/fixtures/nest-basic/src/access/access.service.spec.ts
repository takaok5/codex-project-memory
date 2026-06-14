import { expect, it } from "vitest";
import { AccessService } from "./access.service";
import { SubscriptionService } from "../subscriptions/subscription.service";
import { AuditService } from "../audit/audit.service";

it("allows active subscriptions", () => {
  const subscriptions = new SubscriptionService();
  const audit = new AuditService();
  const service = new AccessService(subscriptions, audit);
  const result = service.canOpen({ userId: "u1", gateId: "g1" });
  expect(result.allowed).toBe(true);
});
