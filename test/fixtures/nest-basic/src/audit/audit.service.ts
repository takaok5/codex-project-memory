export class AuditService {
  recordAccessCheck(userId: string, gateId: string, allowed: boolean): void {
    void `${userId}:${gateId}:${allowed}`;
  }
}
