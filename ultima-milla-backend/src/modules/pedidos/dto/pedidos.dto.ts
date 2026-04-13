export class ItemPedidoDto {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export class CrearPedidoDto {
  cliente_id: string;
  restaurante_id: string;
  direccion_entrega: {
    calle: string;
    distrito: string;
    ciudad: string;
    referencia?: string;
    latitud: number;
    longitud: number;
  };
  items: ItemPedidoDto[];
  metodo_pago: 'tarjeta' | 'efectivo' | 'billetera_digital';
  notas?: string;
}

export class CancelarPedidoDto {
  pedido_id: string;
  motivo: string;
  cancelado_por: 'cliente' | 'restaurante' | 'sistema';
}

export class ConfirmarPedidoRestauranteDto {
  pedido_id: string;
  restaurante_id: string;
  tiempo_estimado_preparacion_minutos: number;
}

export class RechazarPedidoRestauranteDto {
  pedido_id: string;
  restaurante_id: string;
  motivo: string;
}
