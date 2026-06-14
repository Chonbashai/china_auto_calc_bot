import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class CalculateCustomsDto {
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
  @IsPositive()
  yuanRate?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  customs?: number;
}

export interface CalculationResult {
  model: string | null;
  year: number;
  engineVolume: number;
  kw: number;
  costYuan: number;
  yuanRate: number;
  invoice: number;
  customs: number;
  commission: number;
  broker: number;
  lab: number;
  registration: number;
  total: number;
}
