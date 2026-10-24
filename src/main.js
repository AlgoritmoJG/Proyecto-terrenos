import { calcularCuota, filtrarInmuebles } from "./financiamiento.js";

const response = await fetch("/api/catalogo");
if (!response.ok) {
  document.querySelector("#app").innerHTML =
    '<main class="wrap section-space"><h1>No pudimos cargar las propiedades.</h1><p>Comprueba la conexión con la base de datos y vuelve a cargar la página.</p></main>';
  throw new Error("No se pudo cargar el catálogo");
}
const { bancos, inmuebles, modo } = await response.json();
const ciudades = [...new Set(inmuebles.map((p) => p.ciudad))];

const paths = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bed: '<path d="M3 18v3m18-3v3M3 11V5h18v6M3 18h18v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6ZM7 10V7h4v3m2 0V7h4v3"/>',
  bath: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3Zm2 0V5a3 3 0 0 1 6 0M8 6h6M6 20v2m12-2v2"/>',
  area: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5M4 4l6 6m10 10-6-6"/>',
  home: '<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bank: '<path d="m3 8 9-5 9 5v2H3V8Zm2 3v7m7-7v7m7-7v7M3 21h18M4 18h16"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
const logo = `<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 30V13L22 4l17 9v17l-17 10ZM5 13l17 9 17-9M22 22v18M14 8l17 9v17"/></svg><span>terrena<span class="logo-dot">.</span></span>`;
const money = (n) =>
  `Q ${new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(n)}`;
const moneyFull = (n) =>
  `Q ${new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
let favorites = read("terrena-favorites", []);
if (!Array.isArray(favorites)) favorites = [];
let onlyFavorites = false;
let expanded = false;
let activeType = "";
let selectedProperty = 1;
let lastCalculation;
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "El navegador no permite guardar datos. Se conservarán solo durante esta visita.",
    );
    return false;
  }
}

document.querySelector("#app").innerHTML = `
  <header class="site-header wrap">
    <a href="#inicio" class="logo" aria-label="Terrena, inicio">${logo}</a>
    <nav class="desktop-nav" aria-label="Navegación principal">
      <a href="#propiedades" class="active">Propiedades</a><a href="#nosotros">Nuestra esencia</a><a href="#financiamiento">Financiamiento</a>
    </nav>
    <div class="header-actions"><button class="favorites-link" id="favorites-nav" aria-label="Ver favoritos">${icon("heart")}<span id="favorite-count">${favorites.length}</span></button><button class="btn btn-dark contact-trigger">Hablemos ${icon("diagonal")}</button><button class="mobile-menu" id="menu-toggle" aria-label="Abrir menú" aria-expanded="false">${icon("menu")}</button></div>
  </header>
  <nav class="mobile-nav" id="mobile-nav" aria-label="Navegación móvil" hidden><a href="#propiedades">Propiedades</a><a href="#nosotros">Nuestra esencia</a><a href="#financiamiento">Financiamiento</a></nav>
  <main>
    <section id="inicio" class="hero wrap">
      <div class="hero-intro"><div><p class="eyebrow"><span class="tiny-line"></span> ESPACIOS CON PROPÓSITO</p><h1>El lugar donde<br>empieza <em>tu historia.</em></h1></div><div class="hero-aside"><p>Hay lugares que simplemente se sienten bien.<br>Encuentra el tuyo y empieza a vivir<br>como siempre lo imaginaste.</p><a class="text-link" href="#propiedades">Encuentra tu próximo hogar <span class="circle-arrow">${icon("diagonal")}</span></a></div></div>
      <div class="hero-photo"><img src="/images/property-5.jpg" alt="Casa contemporánea con jardín, fachada de madera y amplios ventanales" fetchpriority="high"><div class="hero-shade"></div><span class="photo-label">${icon("sun")} UNA NUEVA FORMA DE HABITAR</span><div class="hero-property"><span class="hero-location">${icon("pin")} San José Acatempa · Jutiapa</span><h2>Más cerca de la naturaleza.<br>Más cerca de ti.</h2><button class="hero-detail" data-detail="1" aria-label="Explorar Casa entre jardines">${icon("diagonal")}</button></div><div class="image-index"><span>01</span><span class="index-line"></span><span>06</span></div></div>
      <form id="search-form" class="search-panel"><div class="search-label"><span>EL PRIMER PASO</span><strong>Tu espacio te espera.</strong></div><label class="search-field"><span>${icon("pin")} Ubicación</span><select id="city" name="city" aria-label="Ubicación"><option value="">Todas las ubicaciones</option>${ciudades.map((c) => `<option>${escape(c)}</option>`).join("")}</select></label><label class="search-field"><span>${icon("home")} Tipo de propiedad</span><select id="type" name="type" aria-label="Tipo de propiedad"><option value="">Todas las propiedades</option><option>Casa</option><option>Apartamento</option><option>Terreno</option></select></label><label class="search-field"><span>Presupuesto máximo</span><select id="budget" name="budget" aria-label="Presupuesto máximo"><option value="">Sin límite</option><option value="1000000">Hasta Q 1,000,000</option><option value="1500000">Hasta Q 1,500,000</option><option value="2000000">Hasta Q 2,000,000</option><option value="2500000">Hasta Q 2,500,000</option></select></label><button class="btn btn-dark search-button" type="submit">${icon("search")} Buscar</button></form>
    </section>
    <section class="trust-strip wrap" aria-label="Nuestro compromiso"><p>Una decisión importante.<br><strong>Un acompañamiento cercano.</strong></p><div>${icon("shield")}<span>Información clara<br>en cada paso</span></div><div>${icon("home")}<span>Espacios elegidos<br>para tu estilo de vida</span></div><div>${icon("bank")}<span>Opciones para planear<br>tu financiamiento</span></div></section>
    <section id="propiedades" class="catalog wrap section-space"><div class="section-heading"><div><p class="eyebrow">ENCUENTRA DONDE PERTENECES</p><h2>Espacios para <em>vivir mejor.</em></h2></div><p>Una selección de lugares con algo especial.<br>Solo falta que los hagas tuyos.</p></div><div class="catalog-toolbar"><div class="filter-tabs" aria-label="Filtrar propiedades"><button class="filter-tab active" data-type="" aria-pressed="true">Todas <span>${String(inmuebles.length).padStart(2, "0")}</span></button><button class="filter-tab" data-type="Casa" aria-pressed="false">Casas</button><button class="filter-tab" data-type="Apartamento" aria-pressed="false">Apartamentos</button><button class="filter-tab" data-type="Terreno" aria-pressed="false">Terrenos</button></div><button class="subtle-button" id="favorites-filter" aria-pressed="false">${icon("heart")} Mis favoritos</button></div><p id="results-status" class="results-status" role="status"></p><div id="property-grid" class="property-grid"></div><div class="catalog-bottom"><p>Un espacio para cada etapa de tu vida.</p><button class="btn btn-outline" id="show-all">Ver todas las propiedades ${icon("arrow")}</button></div></section>
    <section id="ubicacion" class="map-section wrap section-space"><div class="section-heading"><div><p class="eyebrow">CERCA DE LO QUE TE IMPORTA</p><h2>Nuevas raíces en <em>Acatempa.</em></h2></div><p>San José Acatempa, El Copante y El Tablón.<br>Explora un entorno para tu próxima historia.</p></div><div class="map-layout"><div class="map-canvas" aria-label="Mapa esquemático de San José Acatempa"><img src="/images/acatempa-map.svg" alt="Referencia esquemática de San José Acatempa, El Copante y El Tablón, junto a la carretera CA1"><span class="map-label">${icon("pin")} SAN JOSÉ ACATEMPA</span><div class="map-pins">${inmuebles.map((p, i) => `<button class="map-pin map-pin-${i % 6}" data-map-property="${p.id_inmueble}" aria-label="Ver ${escape(p.nombre)} en ${escape(p.ciudad)}">${icon("home")}<span>${money(p.precio)}</span></button>`).join("")}</div><span class="map-disclaimer">Mapa esquemático · Ubicaciones ilustrativas</span></div><div id="map-property" class="map-property"></div></div></section>
    <section id="nosotros" class="about-section wrap section-space"><div class="about-photo"><img src="/images/hero.jpg" alt="Fachada cálida de una casa al anochecer" loading="lazy"><div class="about-note"><span class="note-mark">t.</span><p>No buscamos cualquier lugar.<br><strong>Buscamos el tuyo.</strong></p></div></div><div class="about-copy"><p class="eyebrow">RAÍCES FIRMES. NUEVOS COMIENZOS.</p><h2>Una propiedad es el inicio.<br><em>Tu vida es lo que sigue.</em></h2><p>Sabemos que encontrar un hogar es mucho más que elegir metros cuadrados. Es imaginar las mañanas, las reuniones y todo lo que está por venir.</p><p>Por eso te ayudamos a explorar tus opciones con calma, con información clara y personas que te escuchan.</p><a class="text-link" href="#proceso">Conoce cómo te acompañamos <span class="circle-arrow">${icon("diagonal")}</span></a></div></section>
    <section id="financiamiento" class="finance-section"><div class="wrap finance-grid"><div class="finance-copy"><p class="eyebrow">HAZ ESPACIO PARA TUS PLANES</p><h2>Tu próximo hogar,<br><em>más cerca de lo que crees.</em></h2><p>Conoce una estimación de tu cuota y encuentra un punto de partida para dar el siguiente paso.</p><ul><li>${icon("check")} Compara tasas de bancos de ejemplo</li><li>${icon("check")} Ajusta el enganche y el plazo a tu ritmo</li><li>${icon("check")} Registra tu simulación con tus datos de contacto</li></ul><div class="finance-caption">${icon("shield")} Tú pones los sueños.<br>Nosotros te ayudamos a hacer los números.</div></div><form id="finance-form" class="finance-card"><div class="finance-card-title"><h3>Imagina. Calcula. Acércate.</h3>${icon("bank")}</div><label>Propiedad<select id="finance-property">${inmuebles.map((p) => `<option value="${p.id_inmueble}">${escape(p.nombre)} · ${money(p.precio)}</option>`).join("")}</select></label><div class="finance-row"><label>Banco de ejemplo<select id="bank">${bancos.map((b) => `<option value="${b.id_banco}">${escape(b.nombre)}</option>`).join("")}</select></label><label>Plazo<select id="term"><option value="120">10 años</option><option value="180">15 años</option><option value="240" selected>20 años</option><option value="300">25 años</option></select></label></div><div class="range-heading"><label for="downpayment">Enganche</label><strong id="downpayment-label">20 %</strong></div><input type="range" id="downpayment" min="10" max="80" step="5" value="20"><div class="range-bounds"><span>10 %</span><span id="downpayment-money"></span><span>80 %</span></div><div class="finance-result" aria-live="polite"><span>Tu cuota mensual estimada</span><strong id="monthly-payment"></strong><div><span id="rate-label"></span><span id="loan-amount"></span></div></div><button type="submit" class="btn btn-dark full-width">Guardar mi simulación ${icon("arrow")}</button><p class="fine-print">Simulación ilustrativa en quetzales. Tasa nominal anual fija. No incluye seguros, impuestos ni comisiones. No constituye una oferta de crédito.</p></form></div></section>
    <section id="proceso" class="process wrap section-space"><div class="section-heading"><div><p class="eyebrow">A TU LADO, DE PRINCIPIO A FIN</p><h2>Grandes decisiones.<br><em>Pasos sencillos.</em></h2></div><button class="text-link contact-trigger">Empecemos juntos <span class="circle-arrow">${icon("diagonal")}</span></button></div><div class="steps"><article><span>01 <i></i></span><h3>Encuentra tu lugar</h3><p>Explora propiedades y guarda las que conectan con tu forma de vivir.</p></article><article><span>02 <i></i></span><h3>Conoce cada detalle</h3><p>Revisa sus características y prepara tus preguntas para una visita.</p></article><article><span>03 <i></i></span><h3>Planea tu próximo paso</h3><p>Simula tu financiamiento y descubre un camino hacia tu nuevo hogar.</p></article></div></section>
    <section class="cta wrap"><div><p class="eyebrow">LO MEJOR ESTÁ POR VENIR</p><h2>Tu próxima historia<br><em>merece un buen lugar.</em></h2></div><button class="btn btn-cream contact-trigger">Hablemos de lo que buscas ${icon("diagonal")}</button><span class="cta-decoration" aria-hidden="true">↗</span></section>
  </main>
  <footer class="site-footer wrap"><div class="footer-top"><a href="#inicio" class="logo">${logo}</a><p>Espacios con propósito.<br>Historias por comenzar.</p><a href="#propiedades">Explorar propiedades ${icon("diagonal")}</a><button class="subtle-button" id="saved-records">Mis solicitudes y simulaciones ${icon("arrow")}</button></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Terrena. Un lugar para tu historia.</span><span>Prototipo · Propiedades y bancos de demostración</span><button class="plain-button" id="privacy">Privacidad</button></div></footer>
`;

function propertyCard(p) {
  const c = p.caracteristicas;
  const saved = favorites.includes(p.id_inmueble);
  return `<article class="property-card"><div class="property-image"><button class="image-open" data-detail="${p.id_inmueble}" aria-label="Ver ${escape(p.nombre)}"><img src="/images/${encodeURIComponent(p.imagen || "property-5.jpg")}" alt="${escape(p.nombre)}, ${escape(p.tipo.toLowerCase())} de demostración" loading="lazy"></button><span class="property-badge">${p.destacado ? "SELECCIÓN TERRENA" : "EN VENTA"}</span><button class="favorite-button ${saved ? "saved" : ""}" data-favorite="${p.id_inmueble}" aria-label="${saved ? "Quitar" : "Guardar"} ${escape(p.nombre)} ${saved ? "de" : "en"} favoritos" aria-pressed="${saved}">${icon("heart")}</button><span class="property-type">${escape(p.tipo)}</span></div><div class="property-info"><p class="property-location">${icon("pin")} ${escape(p.ciudad)}</p><button class="property-title" data-detail="${p.id_inmueble}">${escape(p.nombre)} ${icon("diagonal")}</button><div class="property-specs"><span>${icon("bed")} ${c.num_habitaciones} hab.</span><span>${icon("bath")} ${c.num_banos} baños</span><span>${icon("area")} ${p.metraje} m²</span></div><div class="property-price"><strong>${money(p.precio)}</strong><span>Precio de venta</span></div></div></article>`;
}

function renderProperties() {
  const filtered = filtrarInmuebles(inmuebles, {
    ciudad: document.querySelector("#city").value,
    tipo: activeType,
    precioMaximo: document.querySelector("#budget").value,
    favoritos: onlyFavorites ? favorites : null,
  });
  const shown = expanded ? filtered : filtered.slice(0, 3);
  document.querySelector("#property-grid").innerHTML = shown.length
    ? shown.map(propertyCard).join("")
    : `<div class="empty-state">${icon(onlyFavorites ? "heart" : "search")}<h3>${onlyFavorites ? "Tus próximos lugares favoritos" : "Un lugar especial toma tiempo"}</h3><p>${onlyFavorites ? "Guarda una propiedad con el corazón para encontrarla aquí." : "No hay propiedades con estos filtros. Prueba otra ubicación o amplía tu presupuesto."}</p><button id="reset-filters" class="btn btn-outline">Ver todas las propiedades ${icon("arrow")}</button></div>`;
  document.querySelector("#results-status").textContent =
    `${filtered.length} ${filtered.length === 1 ? "propiedad disponible" : "propiedades disponibles"}${onlyFavorites ? " en tus favoritos" : ""} · ${modo === "demo" ? "Inventario de demostración" : "Catálogo del proyecto"}`;
  document.querySelector("#show-all").hidden = expanded || filtered.length <= 3;
  document.querySelector("#favorite-count").textContent = favorites.length;
  document
    .querySelector("#favorites-filter")
    .classList.toggle("selected", onlyFavorites);
  document
    .querySelector("#favorites-filter")
    .setAttribute("aria-pressed", String(onlyFavorites));
  document.querySelectorAll(".filter-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === activeType);
    b.setAttribute("aria-pressed", String(b.dataset.type === activeType));
  });
}
renderProperties();

document.querySelector("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  activeType = document.querySelector("#type").value;
  expanded = true;
  renderProperties();
  document.querySelector("#propiedades").scrollIntoView({ behavior: "smooth" });
});
document.querySelectorAll(".filter-tab").forEach((b) =>
  b.addEventListener("click", () => {
    activeType = b.dataset.type;
    document.querySelector("#type").value = activeType;
    expanded = true;
    renderProperties();
  }),
);
document.querySelector("#show-all").addEventListener("click", () => {
  expanded = true;
  renderProperties();
});
function toggleFavorites() {
  onlyFavorites = !onlyFavorites;
  expanded = true;
  renderProperties();
  document.querySelector("#propiedades").scrollIntoView({ behavior: "smooth" });
}
document
  .querySelector("#favorites-filter")
  .addEventListener("click", toggleFavorites);
document
  .querySelector("#favorites-nav")
  .addEventListener("click", toggleFavorites);

let toastTimer;
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4200);
}
const modal = document.querySelector("#modal");
function openModal(content, cls = "") {
  modal.innerHTML = `<button class="modal-close" aria-label="Cerrar ventana">${icon("close")}</button>${content}`;
  modal.className = cls;
  if (!modal.open) modal.showModal();
}
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest(".modal-close")) modal.close();
});
function detail(id) {
  const p = inmuebles.find((p) => p.id_inmueble === id);
  if (!p) return;
  const c = p.caracteristicas;
  openModal(
    `<img class="detail-image" src="/images/${encodeURIComponent(p.imagen || "property-5.jpg")}" alt="${escape(p.nombre)}"><div class="detail-body"><p class="eyebrow">${escape(p.tipo.toUpperCase())} · ${escape(p.disponibilidad.toUpperCase())} · DEMOSTRACIÓN</p><h2 id="modal-title">${escape(p.nombre)}</h2><p class="property-location">${icon("pin")} ${escape(p.direccion)}, ${escape(p.ciudad)}</p><div class="detail-price">${money(p.precio)}</div><p>${escape(p.descripcion)}</p><div class="detail-specs"><span>${icon("bed")}<strong>${c.num_habitaciones}</strong>Habitaciones</span><span>${icon("bath")}<strong>${c.num_banos}</strong>Baños</span><span>${icon("area")}<strong>${p.metraje} m²</strong>Área construida</span><span>${icon("home")}<strong>${c.num_parqueaderos}</strong>Parqueaderos</span></div><h3>Los detalles hacen la diferencia</h3><dl class="detail-list"><div><dt>Conservación</dt><dd>${escape(c.estado_conservacion)}</dd></div><div><dt>Antigüedad</dt><dd>${p.antiguedad} años</dd></div><div><dt>Modelo</dt><dd>${escape(p.modelo)}</dd></div><div><dt>Material</dt><dd>${escape(p.material)}</dd></div><div><dt>Pisos / nivel</dt><dd>${c.piso}</dd></div><div><dt>Estrato</dt><dd>${c.estrato ?? "No aplica"}</dd></div><div><dt>Agente de ejemplo</dt><dd>${escape(p.agente)}</dd></div><div><dt>Vendedor de ejemplo</dt><dd>${escape(p.vendedor)}</dd></div></dl><div class="detail-actions"><button class="btn btn-dark" data-contact="${id}">Preparar una visita ${icon("diagonal")}</button><button class="btn btn-outline" data-finance="${id}">Simular financiamiento ${icon("bank")}</button></div><p class="fine-print">Fotografía ilustrativa. Ubicación, precio y características son datos de ejemplo.</p></div>`,
    "property-modal",
  );
}

function contact(id = null, finance = null) {
  openModal(
    `<div class="contact-modal"><p class="eyebrow">CADA HISTORIA EMPIEZA CON UNA CONVERSACIÓN</p><h2 id="modal-title">Hablemos de<br><em>tu próximo lugar.</em></h2><p>Cuéntanos qué buscas y registra tu solicitud${finance ? " con tu simulación" : ""}. Se guardará en la base de datos ${modo === "demo" ? "de demostración" : "del proyecto"}. No se envían notificaciones a agentes.</p><form id="contact-form"><div class="finance-row"><label>Nombre<input name="nombre" required maxlength="50" autocomplete="given-name" placeholder="Tu nombre"></label><label>Apellido<input name="apellido" required maxlength="50" autocomplete="family-name" placeholder="Tu apellido"></label></div><label>Correo electrónico<input name="correo" type="email" required maxlength="100" autocomplete="email" placeholder="hola@ejemplo.com"></label><label>Teléfono<input name="telefono" type="tel" required maxlength="25" autocomplete="tel" placeholder="Tu número de contacto"></label><label>¿Qué propiedad te interesa?<select name="inmueble_id"><option value="">Quiero explorar mis opciones</option>${inmuebles.map((p) => `<option value="${p.id_inmueble}" ${p.id_inmueble === id ? "selected" : ""}>${escape(p.nombre)}</option>`).join("")}</select></label><label>Cuéntanos un poco más<textarea name="mensaje" maxlength="1000" rows="3" placeholder="¿Cómo imaginas tu próximo hogar?"></textarea></label><label class="consent"><input type="checkbox" required> Acepto registrar estos datos de contacto en la base de datos del proyecto. En modo demostración utiliza datos ficticios.</label><p id="contact-error" class="form-error" role="alert"></p><button class="btn btn-dark full-width" id="contact-submit">Registrar ${finance ? "solicitud y simulación" : "solicitud"} ${icon("arrow")}</button></form></div>`,
  );
  if (finance) document.querySelector("#contact-form select").disabled = true;
  document
    .querySelector("#contact-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (finance) data.inmueble_id = String(id);
      if (
        !data.nombre.trim() ||
        !data.apellido.trim() ||
        !data.telefono.trim()
      ) {
        toast("Escribe tu nombre, apellido y teléfono.");
        return;
      }
      const button = document.querySelector("#contact-submit");
      const error = document.querySelector("#contact-error");
      button.disabled = true;
      const previous = button.innerHTML;
      button.textContent = "Guardando…";
      error.textContent = "";
      try {
        const res = await fetch("/api/solicitudes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, financiamiento: finance }),
        });
        const result = await res.json();
        if (!res.ok)
          throw new Error(result.error || "No se pudo guardar la solicitud.");
        const solicitudes = read("terrena-requests", []);
        solicitudes.push({
          ...data,
          id_solicitud: result.id_solicitud,
          comprador_id: result.comprador_id,
          fecha: new Date().toISOString(),
          estado: "Registrada en base de datos",
        });
        persist("terrena-requests", solicitudes);
        if (result.prestamo) {
          const records = read("terrena-simulations", []);
          records.push({
            ...result.prestamo,
            cuota: finance.cuota,
            enganche: finance.enganche,
          });
          persist("terrena-simulations", records);
        }
        modal.close();
        toast(
          finance
            ? "Solicitud y simulación registradas en la base de datos."
            : "Solicitud registrada en la base de datos.",
        );
      } catch (err) {
        error.textContent =
          err.message || "No hay conexión. Inténtalo de nuevo.";
      } finally {
        button.disabled = false;
        button.innerHTML = previous;
      }
    });
}

function updateFinance() {
  selectedProperty = Number(document.querySelector("#finance-property").value);
  const p = inmuebles.find((p) => p.id_inmueble === selectedProperty);
  const bank = bancos.find(
    (b) => b.id_banco === Number(document.querySelector("#bank").value),
  );
  if (!p || !bank) {
    document.querySelector("#monthly-payment").textContent = "Sin datos";
    document.querySelector("#finance-form button[type=submit]").disabled = true;
    return;
  }
  const down = Number(document.querySelector("#downpayment").value);
  lastCalculation = calcularCuota(
    p.precio,
    down,
    bank.tasa_interes_base,
    Number(document.querySelector("#term").value),
  );
  document.querySelector("#downpayment-label").textContent = `${down} %`;
  document.querySelector("#downpayment-money").textContent = money(
    lastCalculation.enganche,
  );
  document.querySelector("#monthly-payment").textContent = moneyFull(
    lastCalculation.cuota,
  );
  document.querySelector("#rate-label").textContent =
    `${bank.tasa_interes_base} % anual`;
  document.querySelector("#loan-amount").textContent =
    `${money(lastCalculation.monto)} a financiar`;
}
document
  .querySelector("#finance-form")
  .addEventListener("input", updateFinance);
updateFinance();
document.querySelector("#finance-form").addEventListener("submit", (e) => {
  e.preventDefault();
  contact(selectedProperty, {
    banco_id: Number(document.querySelector("#bank").value),
    plazo_meses: Number(document.querySelector("#term").value),
    enganche_porcentaje: Number(document.querySelector("#downpayment").value),
    cuota: lastCalculation.cuota,
    enganche: lastCalculation.enganche,
  });
});

function recordsModal() {
  const requests = read("terrena-requests", []),
    simulations = read("terrena-simulations", []);
  openModal(
    `<div class="contact-modal"><p class="eyebrow">TU PRÓXIMO CAPÍTULO</p><h2 id="modal-title">Mis planes <em>guardados.</em></h2><p>Este es el historial de registros realizados desde este navegador. Las solicitudes están en la base de datos; las simulaciones no son créditos aprobados.</p><h3>Simulaciones (${simulations.length})</h3>${simulations.length ? simulations.map((s) => `<div class="saved-record"><strong>${inmuebles.find((p) => p.id_inmueble === s.inmueble_id)?.nombre ?? "Propiedad"}</strong><span>${escape(bancos.find((b) => b.id_banco === s.banco_id)?.nombre ?? "Banco")} · ${s.plazo_meses / 12} años · ${s.tasa_interes} % anual</span><span>${moneyFull(s.cuota)} / mes · ${money(s.monto_prestado)} a financiar</span></div>`).join("") : '<p class="muted">Todavía no has guardado una simulación.</p>'}<h3>Solicitudes (${requests.length})</h3>${requests.length ? requests.map((r) => `<div class="saved-record"><strong>${escape(r.nombre)} ${escape(r.apellido)}</strong><span>${escape(inmuebles.find((p) => p.id_inmueble === Number(r.inmueble_id))?.nombre ?? "Explorar opciones")} · Registrada · Ref. ${escape(r.id_solicitud ?? "local")}</span><span>${escape(r.correo)}</span></div>`).join("") : '<p class="muted">Todavía no has preparado una solicitud.</p>'}${requests.length || simulations.length ? '<button class="btn btn-outline full-width" id="clear-records">Limpiar mi historial de este navegador</button>' : ""}</div>`,
  );
}

document.addEventListener("click", (e) => {
  const favorite = e.target.closest("[data-favorite]");
  if (favorite) {
    const id = Number(favorite.dataset.favorite);
    favorites = favorites.includes(id)
      ? favorites.filter((n) => n !== id)
      : [...favorites, id];
    persist("terrena-favorites", favorites);
    renderProperties();
    return;
  }
  const d = e.target.closest("[data-detail]");
  if (d) detail(Number(d.dataset.detail));
  if (e.target.closest(".contact-trigger")) contact();
  const c = e.target.closest("[data-contact]");
  if (c) contact(Number(c.dataset.contact));
  const f = e.target.closest("[data-finance]");
  if (f) {
    modal.close();
    document.querySelector("#finance-property").value = f.dataset.finance;
    updateFinance();
    document
      .querySelector("#financiamiento")
      .scrollIntoView({ behavior: "smooth" });
  }
  if (e.target.closest("#reset-filters")) {
    document.querySelector("#search-form").reset();
    activeType = "";
    onlyFavorites = false;
    expanded = true;
    renderProperties();
  }
  if (e.target.closest("#clear-records")) {
    try {
      localStorage.removeItem("terrena-requests");
      localStorage.removeItem("terrena-simulations");
      recordsModal();
      toast(
        "Historial local eliminado. Los registros de la base de datos se conservan.",
      );
    } catch {
      toast("No se pudieron eliminar los datos.");
    }
  }
});
document
  .querySelector("#saved-records")
  .addEventListener("click", recordsModal);
document
  .querySelector("#privacy")
  .addEventListener("click", () =>
    openModal(
      `<div class="contact-modal"><p class="eyebrow">INFORMACIÓN CLARA</p><h2 id="modal-title">Tu <em>privacidad.</em></h2><p>Terrena es un prototipo de demostración. Las solicitudes de contacto y las simulaciones se envían al servidor Python y se guardan en la base de datos configurada. No se contratan productos financieros ni se envían notificaciones.</p><p>Los favoritos y una copia del historial de solicitudes se guardan en el almacenamiento local de este navegador. Evita introducir datos personales reales en dispositivos compartidos.</p><p>Puedes limpiar el historial local en “Mis solicitudes y simulaciones”. Esto no elimina registros de Oracle o SQLite; su eliminación corresponde al responsable de la base de datos. Para borrar los favoritos, quita los corazones guardados o elimina los datos del sitio en tu navegador.</p><p>No usamos herramientas de analítica ni cargamos fuentes o imágenes de servidores externos.</p></div>`,
    ),
  );
document.querySelector("#menu-toggle").addEventListener("click", () => {
  const nav = document.querySelector("#mobile-nav");
  nav.hidden = !nav.hidden;
  document
    .querySelector("#menu-toggle")
    .setAttribute("aria-expanded", String(!nav.hidden));
});
document.querySelectorAll("#mobile-nav a").forEach((a) =>
  a.addEventListener("click", () => {
    document.querySelector("#mobile-nav").hidden = true;
    document
      .querySelector("#menu-toggle")
      .setAttribute("aria-expanded", "false");
  }),
);

function showMapProperty(id) {
  const p = inmuebles.find((p) => p.id_inmueble === id);
  if (!p) return;
  document.querySelector("#map-property").innerHTML =
    `<img src="/images/${encodeURIComponent(p.imagen || "property-5.jpg")}" alt="${escape(p.nombre)}"><p class="eyebrow">UN LUGAR PARA TI</p><h3>${escape(p.nombre)}</h3><p>${icon("pin")} ${escape(p.ciudad)} · ${p.metraje} m²</p><strong>${money(p.precio)}</strong><button class="btn btn-dark" data-detail="${p.id_inmueble}">Conocer la propiedad ${icon("diagonal")}</button>`;
  document.querySelectorAll("[data-map-property]").forEach((b) => {
    const active = Number(b.dataset.mapProperty) === id;
    b.classList.toggle("selected", active);
    b.setAttribute("aria-pressed", String(active));
  });
}
document
  .querySelectorAll("[data-map-property]")
  .forEach((b) =>
    b.addEventListener("click", () =>
      showMapProperty(Number(b.dataset.mapProperty)),
    ),
  );
showMapProperty(inmuebles[0]?.id_inmueble);
