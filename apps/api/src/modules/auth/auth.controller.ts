import { Body, Controller, Get, Headers, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ChildLoginDto, JoinChildFamilyDto, JoinFamilyDto, LoginDto, RegisterDto, SetChildPatternDto } from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto) {
    return this.ok(await this.authService.register(dto));
  }

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.ok(await this.authService.login(dto));
  }

  @Post("join")
  async joinFamily(@Body() dto: JoinFamilyDto) {
    return this.ok(await this.authService.joinFamily(dto));
  }

  @Post("join-child")
  async joinChildFamily(@Body() dto: JoinChildFamilyDto) {
    return this.ok(await this.authService.joinChildFamily(dto));
  }

  @Post("login-child")
  async loginChild(@Body() dto: ChildLoginDto) {
    return this.ok(await this.authService.loginChild(dto));
  }

  @Post("child-pattern")
  async setChildPattern(@Body() dto: SetChildPatternDto) {
    return this.ok(await this.authService.setChildPattern(dto));
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    return this.ok(await this.authService.me(this.tokenFrom(authorization)));
  }

  @Post("heartbeat")
  async heartbeat(@Headers("authorization") authorization?: string) {
    return this.ok(await this.authService.heartbeat(this.tokenFrom(authorization)));
  }

  @Post("logout")
  async logout(@Headers("authorization") authorization?: string) {
    return this.ok(await this.authService.logout(this.tokenFrom(authorization)));
  }

  private tokenFrom(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException("缺少登录凭证");
    return token;
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
