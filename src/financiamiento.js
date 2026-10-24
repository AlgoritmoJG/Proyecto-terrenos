export function calcularCuota(
  precio,
  enganchePorcentaje,
  tasaAnual,
  plazoMeses,
) {
  if (
    ![precio, enganchePorcentaje, tasaAnual, plazoMeses].every(
      Number.isFinite,
    ) ||
    precio <= 0 ||
    enganchePorcentaje < 0 ||
    enganchePorcentaje >= 100 ||
    tasaAnual < 0 ||
    !Number.isInteger(plazoMeses) ||
    plazoMeses <= 0
  ) {
    throw new RangeError("Revisa el precio, enganche, tasa y plazo.");
  }
  const enganche = (precio * enganchePorcentaje) / 100;
  const monto = precio - enganche;
  const tasaMensual = tasaAnual / 1200;
  const cuota =
    tasaMensual === 0
      ? monto / plazoMeses
      : (monto * tasaMensual) / (1 - (1 + tasaMensual) ** -plazoMeses);
  return {
    monto,
    enganche,
    cuota,
    total: cuota * plazoMeses,
    intereses: cuota * plazoMeses - monto,
  };
}

export function filtrarInmuebles(
  inmuebles,
  { ciudad = "", tipo = "", precioMaximo = "", favoritos = null } = {},
) {
  return inmuebles.filter(
    (p) =>
      (!ciudad || p.ciudad === ciudad) &&
      (!tipo || p.tipo === tipo) &&
      (!precioMaximo || p.precio <= Number(precioMaximo)) &&
      (!favoritos || favoritos.includes(p.id_inmueble)),
  );
}
