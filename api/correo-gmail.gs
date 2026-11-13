// Script de Google (Apps Script) que manda los recibos del mercadillo desde tu Gmail.
// Se copia en script.google.com y se publica como «Aplicación web». La API lo llama con la clave.
// Límite de Gmail: unos 100 correos al día con una cuenta gratuita.

// Cambia esto por una palabra secreta larga inventada por ti (la misma que guardes en CORREO_CLAVE).
const CLAVE = "PON_AQUI_TU_PALABRA_SECRETA";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.clave || d.clave !== CLAVE) return respuesta({ ok: false, error: "clave incorrecta" });
    // Sin destinatario (prueba): se lo manda a sí mismo.
    const para = d.para || Session.getEffectiveUser().getEmail();
    const adjuntos = (d.adjuntos || []).map(a => Utilities.newBlob(Utilities.base64Decode(a.contenido), a.tipo, a.nombre));
    MailApp.sendEmail({ to: para, subject: d.asunto, body: d.texto, name: "Mercadillo de Charcaland", attachments: adjuntos });
    return respuesta({ ok: true });
  } catch (err) {
    return respuesta({ ok: false, error: String(err) });
  }
}

function respuesta(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecútala una vez desde el editor para dar permiso a mandar correos (no manda nada).
function darPermiso() {
  MailApp.getRemainingDailyQuota();
}
