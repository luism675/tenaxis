import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum DashboardPresetModule {
  SERVICIOS = 'SERVICIOS',
  CLIENTES = 'CLIENTES',
}

export const DASHBOARD_PRESET_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'emerald',
  'teal',
  'sky',
  'blue',
  'indigo',
  'pink',
] as const;

export type DashboardPresetColor = (typeof DASHBOARD_PRESET_COLORS)[number];

export class ListDashboardPresetsDto {
  @IsEnum(DashboardPresetModule)
  module: DashboardPresetModule;
}

export class CreateDashboardPresetDto {
  @IsEnum(DashboardPresetModule)
  module: DashboardPresetModule;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsIn(DASHBOARD_PRESET_COLORS)
  colorToken: DashboardPresetColor;

  @Type(() => Boolean)
  @IsBoolean()
  isShared: boolean;

  @IsObject()
  filters: Record<string, unknown>;
}

export class UpdateDashboardPresetDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsIn(DASHBOARD_PRESET_COLORS)
  colorToken?: DashboardPresetColor;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
