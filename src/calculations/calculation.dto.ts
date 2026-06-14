import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class CalculateCustomsDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  year!: number;

  @IsInt()
  @IsPositive()
  engineVolume!: number;

  @IsInt()
  @IsPositive()
  kw!: number;

  @IsNumber()
  @IsPositive()
  costRub!: number;

  @IsNumber()
  @IsPositive()
  costYuan!: number;
}

export class CalculationInputDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(1990)
  @Max(new Date().getFullYear() + 1)
  year!: number;

  @IsInt()
  @IsPositive()
  engineVolume!: number;

  @IsInt()
  @IsPositive()
  kw!: number;

  @IsNumber()
  @IsPositive()
  costYuan!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.2)
  bankCommissionRate?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  yuanRate?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  customs?: number;
}

export interface CalculationResult {
  model: string | null;
  month: number;
  year: number;
  releaseDateLabel: string;
  vehicleAgeLabel: string;
  calcusAgeLabel: string;
  isPreferentialUtil: boolean;
  utilStatusLabel: string;
  engineVolume: number;
  kw: number;
  costYuan: number;
  yuanRate: number;
  yuanRateSourceLabel: string;
  bankCommissionRate: number;
  bankCommissionLabel: string;
  invoice: number;
  customs: number;
  customsSourceLabel: string;
  commission: number;
  broker: number;
  lab: number;
  registration: number;
  total: number;
}
