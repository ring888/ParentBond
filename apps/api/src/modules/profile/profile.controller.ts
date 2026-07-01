import { Body, Controller, Get, Patch, Query } from "@nestjs/common";
import { ChildProfileQueryDto, ParentProfileQueryDto, UpdateChildProfileDto, UpdateParentProfileDto } from "./dto/profile.dto";
import { ProfileService } from "./profile.service";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("child")
  async childSummary(@Query() query: ChildProfileQueryDto) {
    return this.ok(await this.profileService.childSummary(query));
  }

  @Patch("child")
  async updateChildProfile(@Body() dto: UpdateChildProfileDto) {
    return this.ok(await this.profileService.updateChildProfile(dto));
  }

  @Get("parent")
  async parentSummary(@Query() query: ParentProfileQueryDto) {
    return this.ok(await this.profileService.parentSummary(query));
  }

  @Get("parent/child-detail")
  async parentChildDetail(@Query() query: ParentProfileQueryDto) {
    return this.ok(await this.profileService.parentChildDetail(query));
  }

  @Patch("parent")
  async updateParentProfile(@Body() dto: UpdateParentProfileDto) {
    return this.ok(await this.profileService.updateParentProfile(dto));
  }

  private ok<T>(data: T) {
    return { code: 0, data, message: "ok" };
  }
}
