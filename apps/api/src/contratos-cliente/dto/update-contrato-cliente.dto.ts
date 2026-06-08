import { PartialType } from '@nestjs/mapped-types';
import { CreateContratoClienteDto } from './create-contrato-cliente.dto';

export class UpdateContratoClienteDto extends PartialType(
  CreateContratoClienteDto,
) {}
