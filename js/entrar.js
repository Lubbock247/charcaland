// Entrar sin Discord (cuenta temporal de un admin), solo con SU enlace: entrar.html#c=CÓDIGO.
// Correo y contraseña; la primera vez, la contraseña que escriba (dos veces) queda como la suya.
// La sesión se guarda igual que la de Discord, así que el resto de la web funciona igual.
(async function () {
  const caja = document.getElementById("caja-entrar");
  const codigo = new URLSearchParams(location.hash.slice(1)).get("c");
  const nada = t => { caja.innerHTML = `<div class="vacio">${t}<br><br><a class="btn" href="#" id="dc">Entrar con Discord</a></div>`;
    document.getElementById("dc").onclick = e => { e.preventDefault(); irALogin(); }; };
  if (!codigo) return nada("Para entrar, usa Discord.");
  let est;
  try { est = await api("/api/cuenta/enlace", { method: "POST", body: JSON.stringify({ codigo }) }); }
  catch { caja.innerHTML = `<div class="vacio">No se pudo comprobar el enlace. Inténtalo más tarde.</div>`; return; }
  if (!est.vale) return nada("Este enlace ya no sirve.");
  caja.innerHTML = `<form id="f" class="form-entrar">
    <h1>Entrar</h1>
    ${est.nueva ? `<p class="ayuda">Es la primera vez: la contraseña que pongas será la tuya.</p>` : ""}
    <label>Correo</label><input name="correo" type="email" autocomplete="username" required>
    <label>Contraseña</label><input name="contrasena" type="password" autocomplete="${est.nueva ? "new-password" : "current-password"}" required minlength="8">
    ${est.nueva ? `<label>Repite la contraseña</label><input name="repite" type="password" autocomplete="new-password" required minlength="8">` : ""}
    <div class="aviso oculto" id="err"></div>
    <button type="submit">Entrar</button>
  </form>`;
  const f = document.getElementById("f"), err = document.getElementById("err");
  f.onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (est.nueva && d.contrasena !== d.repite) { err.textContent = "Las contraseñas no coinciden"; err.classList.remove("oculto"); return; }
    const b = f.querySelector("button"); b.disabled = true;
    try {
      const r = await api("/api/cuenta/entrar", { method: "POST", body: JSON.stringify({ codigo, correo: d.correo, contrasena: d.contrasena }) });
      try { localStorage.setItem("dc_token", r.token); } catch {}
      location.href = "perfil.html";
    } catch (er) { err.textContent = er.message; err.classList.remove("oculto"); b.disabled = false; }
  };
})();
