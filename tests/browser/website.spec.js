import { test, expect } from "@playwright/test";

test("carga sin errores y muestra más propiedades", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("tu historia");
  await expect(page.locator(".property-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Ver todas las propiedades", exact: true })
    .click();
  await expect(page.locator(".property-card")).toHaveCount(6);
  expect(errors).toEqual([]);
  expect(
    await page
      .locator("img")
      .evaluateAll(
        (images) => images.filter((i) => i.complete && !i.naturalWidth).length,
      ),
  ).toBe(0);
});

test("búsqueda combinada, sin resultados y restablecer", async ({ page }) => {
  await page.goto("/");
  await page.locator("#city").selectOption("San José Acatempa");
  await page.locator("#type").selectOption("Apartamento");
  await page.locator("#budget").selectOption("1000000");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-title")).toContainText(
    "Horizonte urbano",
  );
  await page.getByRole("button", { name: "Terrenos", exact: true }).click();
  await expect(page.locator(".empty-state")).toContainText(
    "No hay propiedades",
  );
  await page.locator("#reset-filters").click();
  await expect(page.locator(".property-card")).toHaveCount(6);
});

test("favoritos se conservan al recargar", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Guardar Casa entre jardines en favoritos" })
    .click();
  await page.reload();
  await expect(page.locator("#favorite-count")).toHaveText("1");
  await page.locator("#favorites-nav").click();
  await expect(page.locator(".property-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Quitar Casa entre jardines de favoritos" })
    .click();
  await expect(page.locator(".empty-state")).toContainText("favoritos");
});

test("ficha de inmueble y navegación a financiamiento", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ver Casa entre jardines", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Concreto y madera");
  await page
    .getByRole("button", { name: "Simular financiamiento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#finance-property")).toHaveValue("1");
  const before = await page.locator("#monthly-payment").textContent();
  await page.locator("#term").selectOption("120");
  expect(await page.locator("#monthly-payment").textContent()).not.toBe(before);
});

test("registra solicitud y simulación relacionadas en el servidor", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#finance-form button[type=submit]").click();
  await page.locator("#contact-form input[name=nombre]").fill("Persona");
  await page
    .locator("#contact-form input[name=apellido]")
    .fill("Prueba navegador");
  await page
    .locator("#contact-form input[name=correo]")
    .fill("navegador@example.com");
  await page.locator("#contact-form input[name=telefono]").fill("55550000");
  await page.locator("#contact-form input[type=checkbox]").check();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/solicitudes") && r.request().method() === "POST",
  );
  await page.locator("#contact-submit").click();
  const result = await response;
  expect(result.status()).toBe(201);
  const record = await result.json();
  expect(record.prestamo.comprador_id).toBe(record.comprador_id);
  expect(record.prestamo.estado).toBe("Simulacion");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator("#saved-records").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Persona Prueba navegador",
  );
  await expect(page.getByRole("dialog")).toContainText("Simulaciones (1)");
});

test("mapa interactivo muestra la propiedad elegida", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-map-property="2"]').click();
  await expect(page.locator("#map-property")).toContainText(
    "Un nuevo comienzo",
  );
  await page.locator("#map-property button").click();
  await expect(page.locator("#modal-title")).toHaveText("Un nuevo comienzo");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("móvil sin desbordamiento y menú funcional", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#mobile-nav")).toBeVisible();
  await page.locator('#mobile-nav a[href="#financiamiento"]').click();
  await expect(page.locator("#mobile-nav")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
