import { AccessService, AccessRequest } from "../access/access.service";

export class TurnstileService {
  constructor(private readonly access: AccessService) {}

  open(request: AccessRequest): boolean {
    const decision = this.access.canOpen(request);
    if (!decision.allowed) return false;
    return true;
  }
}
