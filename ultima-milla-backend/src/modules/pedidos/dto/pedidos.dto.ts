import { IsString, IsNumber, IsArray, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemPedidoDto {
  @IsString()
  producto_id: string;

  @IsString()
  nombre: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  precio_unitario: number;
}

export class DireccionEntregaDto {
  @IsString()
  calle: string;

  @IsString()
  distrito: string;

  @IsString()
  ciudad: string;

  @IsString()
  @IsOptional()
  referencia?: string;

  @IsNumber()
  latitud: number;

  @IsNumber()
  longitud: number;
}

export class CrearPedidoDto {
  @IsString()
  cliente_id: string;

  @IsString()
  restaurante_id: string;

  @ValidateNested()
  @Type(() => DireccionEntregaDto)
  direccion_entrega: DireccionEntregaDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  items: ItemPedidoDto[];

  @IsEnum(['tarjeta', 'efectivo', 'billetera_digital'])
  metodo_pago: 'tarjeta' | 'efectivo' | 'billetera_digital';

  @IsString()
  @IsOptional()
  notas?: string;
}

export class CancelarPedidoDto {
  @IsString()
  pedido_id: string;

  @IsString()
  motivo: string;

  @IsEnum(['cliente', 'restaurante', 'sistema'])
  cancelado_por: 'cliente' | 'restaurante' | 'sistema';
}

export class ConfirmarPedidoRestauranteDto {
  @IsString()
  pedido_id: string;

  @IsString()
  restaurante_id: string;

  @IsNumber()
  tiempo_estimado_preparacion_minutos: number;
}

export class RechazarPedidoRestauranteDto {
  @IsString()
  pedido_id: string;

  @IsString()
  restaurante_id: string;

  @IsString()
  motivo: string;
}
