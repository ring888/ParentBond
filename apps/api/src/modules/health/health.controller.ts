import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      code: 0,
      data: {
        status: "ok",
        service: "parentbond-api",
        timestamp: new Date().toISOString(),
      },
      message: "ok",
    };
  }
}
