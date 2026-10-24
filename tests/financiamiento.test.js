import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularCuota, filtrarInmuebles } from "../src/financiamiento.js";

test("amortización: cuota, capital y coste total", () => {
  const c = calcularCuota(1850000, 20, 8.5, 240);
  assert.equal(c.monto, 1480000);
  assert.equal(c.enganche, 370000);
  assert.ok(Math.abs(c.cuota - 12843.7830467) < 0.01);
  assert.ok(c.total > c.monto);
  assert.equal(c.intereses, c.total - c.monto);
});
test("tasa cero y entradas inválidas", () => {
  assert.equal(calcularCuota(100000, 20, 0, 100).cuota, 800);
  for (const values of [
    [-1, 20, 8, 120],
    [100, 100, 8, 120],
    [100, 20, -1, 120],
    [100, 20, 8, 0],
    [100, 20, 8, 1.5],
    [NaN, 20, 8, 120],
  ]) {
    assert.throws(() => calcularCuota(...values), RangeError);
  }
});
test("combina ubicación, tipo, presupuesto y favoritos", () => {
  const rows = [
    { id_inmueble: 1, ciudad: "San José Acatempa", tipo: "Casa", precio: 100 },
    { id_inmueble: 2, ciudad: "San José Acatempa", tipo: "Casa", precio: 200 },
    { id_inmueble: 3, ciudad: "El Copante", tipo: "Terreno", precio: 80 },
  ];
  assert.deepEqual(
    filtrarInmuebles(rows, {
      ciudad: "San José Acatempa",
      tipo: "Casa",
      precioMaximo: 150,
      favoritos: [1, 3],
    }).map((p) => p.id_inmueble),
    [1],
  );
  assert.equal(filtrarInmuebles(rows, { favoritos: [] }).length, 0);
});
