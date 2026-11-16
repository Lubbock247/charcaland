// Service worker mínimo: no guarda nada, todo se pide a la web en cada momento.
// Solo existe para que el móvil permita instalar la web como app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
