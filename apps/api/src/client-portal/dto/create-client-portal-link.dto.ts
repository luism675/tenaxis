import { IsOptional, IsUrl } from 'class-validator';

export class CreateClientPortalLinkDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, require_tld: false })
  baseUrl?: string;
}
