import { Body, Controller, Post } from "@nestjs/common";
import { AccessService, AccessRequest } from "./access.service";

@Controller("access")
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post("open")
  open(@Body() request: AccessRequest) {
    return this.access.canOpen(request);
  }
}
