// =====================================================
//  AQUÍ SE EDITA EL CONTENIDO DE LA WEB (sin tocar el resto)
//  Todo lo marcado como PROVISIONAL es de ejemplo.
// =====================================================

const CONFIG = {
  nombreServidor: "Charcaland",          // PROVISIONAL
  api: "https://charcaland-api.lubbock247.workers.dev",  // servidor de cuentas y saldo
  invitacionDiscord: "",  // Enlace de invitación al Discord (si está vacío, el botón no sale)
  // Se rellenan cuando se creen en Discord (ver instrucciones):
  discordClientId: "1569682266156957696",   // ID de la aplicación de Discord (para "Entrar con Discord")
  webhookDiscord: "https://discord.com/api/webhooks/1569680522018558060/J8XXc0a-cgfbuvwLY9BKVezpAIgwObbNgUtZd5tra-cUEBtyPDWd5CMS5WKVTokYkQqe",    // Enlace del webhook del canal donde llegan las sugerencias
};

const UPDATES = [
  { fecha: "2026-11-10", titulo: "Nueva web del servidor", etiqueta: "Web",
    texto: "Estrenamos esta página con noticias, eventos, lore y un buzón de sugerencias." },
  { fecha: "2026-11-01", titulo: "Expansiones de Dominio (en pruebas)", etiqueta: "Mod",
    texto: "Primer dominio disponible: Black Hand of Catastrophe. Pronto más." },
];

const EVENTOS = [
  { fecha: "2026-12-01", titulo: "Evento de ejemplo", estado: "Próximo",
    texto: "PROVISIONAL: aquí irá la descripción, las reglas y los premios." },
];
