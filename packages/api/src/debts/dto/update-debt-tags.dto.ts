import { IsArray, IsString } from 'class-validator';

export interface UpdateDebtTagsInput {
  tags: string[];
}

export class UpdateDebtTagsDto implements UpdateDebtTagsInput {
  @IsArray() @IsString({ each: true }) tags!: string[];
}
