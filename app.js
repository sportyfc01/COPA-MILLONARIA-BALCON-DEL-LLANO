/************************************************
 * CONFIG
 ************************************************/
const SHEET_ID = "11SorkQHnT0rlNKiAICx6OJhQmFKWdwEQQhecgGTBCsw";
const URL_INICIO = `https://opensheet.elk.sh/${SHEET_ID}/inicio`;
let seccionActual = "inicio";
// Esta es la URL "publicada" que me enviaste (usarla para PARTIDOS evita problemas de permisos)
const PARTIDOS_URL_PUBLIC = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnYLW54KrNJRdmjHXfT6kEW-U9OUbdbdwmDYuKfIGVdG1MgTFeHsOBRWwvS7Fg9HBwRscQ5wEtNgMX/pub?output=csv";

const GID_PARTIDOS = "295842768"; // (no usado si PARTIDOS_URL_PUBLIC funciona)
const GID_JUGADOS  = "1896222763";
const GID_inicio  = "1896222763";
const GID_GRUPO_A  = "115004881";
const GID_GRUPO_B  = "455368574";
const GID_OCTAVOS  = "1451722684";

const urls = {
  inicio: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_PARTIDOS}`,
  partidos: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_PARTIDOS}`,
  jugados : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_JUGADOS}`,
  grupoA  : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_GRUPO_A}`,
  grupoB  : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_GRUPO_B}`,
  octavos : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_OCTAVOS}`,
};

/************************************************
 * UTILIDADES
 ************************************************/
const limpiarCelda = (celda = "") => String(celda || "").replace(/^"+|"+$/g, "").trim();
const filaVacia = (fila) => !fila || fila.every(c => !c || String(c).trim() === "");

function parseCSV(text) {
  const lines = text.replace(/\r/g,"").split("\n").filter(l => l !== "");
  const rows = [];
  for (const line of lines) {
    const cells = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(limpiarCelda(cur)); cur = "";
      } else cur += ch;
    }
    cells.push(limpiarCelda(cur));
    rows.push(cells);
  }
  let maxCol = 0;
  rows.forEach(r => {
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] && String(r[i]).trim() !== "") { maxCol = Math.max(maxCol, i); break; }
    }
  });
  return rows.map(r => r.slice(0, maxCol + 1));
}

function parseFechaFlexible(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  let s = String(v).trim();
  if (/\s+\d{1,2}:\d{2}/.test(s)) s = s.split(/\s+/)[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split("-").map(n=>parseInt(n,10));
    return new Date(y,m-1,d);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d,m,y] = s.split("/").map(n=>parseInt(n,10));
    return new Date(y,m-1,d);
  }
  if (/^\d+$/.test(s)) {
    const base = new Date(1899,11,30);
    return new Date(base.getTime() + parseInt(s,10) * 86400000);
  }
  const dt = new Date(s);
  return isNaN(dt) ? null : dt;
}

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const toDisplay = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

function getEscudoUrl(value) {
  if (!value) return "";
  value = String(value).trim();
  const mImage = /IMAGE\("([^"]+)"\)/i.exec(value);
  if (mImage) return mImage[1];
  const gdrive = /\/file\/d\/([^/]+)\//.exec(value);
  if (gdrive) return `https://drive.google.com/uc?export=view&id=${gdrive[1]}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (/\.(png|jpg|jpeg|svg|gif)$/i.test(value)) return `escudos/${value}`;
  return value;
}
function getEscudoUrl(value) {
  if (!value) return "";
  value = String(value).trim();

  // 1. Si ya es una URL de imagen directa (que no sea Drive), úsala
  if (/^https?:\/\//i.test(value) && !value.includes("drive.google.com")) {
    return value;
  }

  // 2. Si el valor es solo el nombre de un archivo (ej: "Barcelona.png")
  // Simplemente devolvemos el nombre para que lo busque en la carpeta principal de GitHub
  if (/\.(png|jpg|jpeg|svg|gif|webp)$/i.test(value)) {
    return value; 
  }

  // 3. Si por alguna razón sigues recibiendo un link de Drive, esto intenta limpiarlo
  // Pero recuerda: lo ideal es que en tu Excel o base de datos solo pongas "Barcelona.png"
  const gdrive = /\/file\/d\/([^/]+)\//.exec(value) || /\/d\/([^/]+)/.exec(value);
  if (gdrive) {
    return `https://lh3.googleusercontent.com/u/0/d/${gdrive[1]}`;
  }

  return value;
}

/************************************************
 * RENDER
 ************************************************/
function renderCards(contenedorId, items) {
  const el = document.getElementById(contenedorId);
  if (!el) return;
  el.innerHTML = "";
  if (!items || items.length === 0) {
    el.innerHTML = "<p class='placeholder'>No hay datos.</p>";
    return;
  }
  for (const it of items) {
    const card = document.createElement("div");
    card.className = "match-card";
    let estadoClass = "";
    if (it.estado) {
      const est = String(it.estado).toLowerCase();
      if (est.includes("vivo")) estadoClass = "estado-en-vivo";
      else if (est.includes("descanso")) estadoClass = "estado-descanso";
      else if (est.includes("finalizado")) estadoClass = "estado-finalizado";
      else if (est.includes("pendiente")) estadoClass = "estado-pendiente";
    }
    const logoLocalHtml = it.logoLocal ? `<img src="${getEscudoUrl(it.logoLocal)}" class="team-logo" onerror="this.style.opacity=.25"/>` : "";
    const logoVisitHtml = it.logoVisit ? `<img src="${getEscudoUrl(it.logoVisit)}" class="team-logo" onerror="this.style.opacity=.25"/>` : "";
    card.innerHTML = `
      <div class="match-header">
        <div class="match-date">${it.fechaTexto || ""}</div>
        ${it.hora ? `<div class="match-time">${it.hora}</div>` : ""}
      </div>
      <div class="match-main">
        <div class="team team--home">
          ${logoLocalHtml}
          <div class="team-name">${it.local || ""}</div>
          ${it.gl !== undefined && it.gl !== "" ? `<div class="score">${it.gl}</div>` : ""}
        </div>
        <div class="vs">${it.vs || "VS"}</div>
        <div class="team team--away">
          ${logoVisitHtml}
          <div class="team-name">${it.visitante || ""}</div>
          ${it.gv !== undefined && it.gv !== "" ? `<div class="score">${it.gv}</div>` : ""}
        </div>
      </div>
      ${it.estado ? `<div class="estado ${estadoClass}">${it.estado}</div>` : ""}
    `;
    el.appendChild(card);
  }
}

function renderTabla(idTabla, rows) {
  const tabla = document.getElementById(idTabla);
  if (!tabla) return;
  const thead = tabla.querySelector("thead");
  const tbody = tabla.querySelector("tbody");
  thead.innerHTML = ""; tbody.innerHTML = "";
  if (!rows || rows.length === 0) {
    tbody.innerHTML = "<tr><td colspan='20'>No hay datos</td></tr>";
    return;
  }
  const headers = rows[0].map(h => h || "");
  const iEscudo = headers.findIndex(h => String(h).toLowerCase().includes("escud"));
  const iEquipo = headers.findIndex(h => String(h).toLowerCase().includes("equipo"));
  const headersFiltrados = headers.filter((_, idx) => idx !== iEscudo);
  thead.innerHTML = `<tr>${headersFiltrados.map(h => `<th>${h}</th>`).join("")}</tr>`;
  rows.slice(1).forEach(r => {
    if (filaVacia(r)) return;
    const tr = document.createElement("tr");
    r.forEach((c, i) => {
      if (i === iEscudo) return;
      const td = document.createElement("td");
      if (i === iEquipo) {
        td.classList.add("equipo-clasificacion");
        if (iEscudo >= 0 && r[iEscudo]) {
          const img = document.createElement("img");
          img.src = getEscudoUrl(r[iEscudo]);
          img.onerror = function(){ this.style.opacity = 0.25; };
          td.appendChild(img);
        }
        const span = document.createElement("span");
        span.textContent = limpiarCelda(c);
        td.appendChild(span);
      } else td.textContent = limpiarCelda(c);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/************************************************
 * CARGA DE DATOS
 ************************************************/
async function cargarCSV(url) {
  const res = await fetch(url, {cache: "no-store"});
  if (!res.ok) throw new Error("Error CSV");
  const text = await res.text();
  return parseCSV(text);
}

async function cargarInicio() {
  try {
    const res = await fetch(URL_INICIO);
    const data = await res.json();
    document.querySelector(".historias").innerHTML = "";
    document.querySelector(".banner").innerHTML = "";
    document.querySelector(".principal").innerHTML = "";
    document.querySelector(".destacado ul").innerHTML = "";
    document.querySelector(".momentos").innerHTML = "";
    document.querySelector(".videos").innerHTML = "";
    document.querySelector(".portada").innerHTML = "";

    data.forEach(item => {
      if(item.tipo === "historia") {
        document.querySelector(".historias").innerHTML += `<div class="historia"><img src="${item.imagen}"><p>${item.titulo}</p></div>`;
      }
      if(item.tipo === "banner") document.querySelector(".banner").innerHTML = `<img src="${item.imagen}">`;
      if(item.tipo === "principal") document.querySelector(".principal").innerHTML = `<img src="${item.imagen}">`;
      if(item.tipo === "destacado") document.querySelector(".destacado ul").innerHTML += `<li>${item.titulo}</li>`;
      if(item.tipo === "momento") {
        document.querySelector(".momentos").innerHTML += `<div class="card"><img src="${item.imagen}"><p>${item.titulo}</p></div>`;
      }
      if(item.tipo === "video") {
        const id = item.link.split("v=")[1]?.split("&")[0];
        document.querySelector(".videos").innerHTML += `<iframe src="https://www.youtube.com/embed/${id}"></iframe>`;
      }
      if(item.tipo === "portada") {
        document.querySelector(".portada").innerHTML += `<div class="card"><img src="${item.imagen}"><p>${item.titulo}</p></div>`;
      }
    });
  } catch (e) { console.error("Error inicio:", e); }
}

let jugadosState = [];

async function cargarTodo() {
  try {
    // PARTIDOS
    try {
      const partidosRows = await cargarCSV(urls.partidos);
      const headers = partidosRows[0].map(h => String(h||"").toLowerCase());
      const iFecha = headers.indexOf("fecha"), iHora = headers.indexOf("hora");
      const iLocal = headers.indexOf("equipo local") >= 0 ? headers.indexOf("equipo local") : headers.indexOf("local");
      const iLogoLocal = headers.indexOf("logo local") >=0 ? headers.indexOf("logo local") : headers.indexOf("escudo local");
      const iVisit = headers.indexOf("equipo visitante") >=0 ? headers.indexOf("equipo visitante") : headers.indexOf("visitante");
      const iLogoVisit = headers.indexOf("logo visitante") >=0 ? headers.indexOf("logo visitante") : headers.indexOf("escudo visitante");
      const iGL = headers.indexOf("goles local") >=0 ? headers.indexOf("goles local") : headers.indexOf("g-local");
      const iGV = headers.indexOf("goles visitante") >=0 ? headers.indexOf("goles visitante") : headers.indexOf("g-visitante");
      const iEstado = headers.indexOf("estado");

      const items = partidosRows.slice(1).filter(r => !filaVacia(r)).map(r => {
        const d = parseFechaFlexible(r[iFecha]);
        return {
          fechaTexto: d ? toDisplay(d) : (r[iFecha] || ""),
          hora: iHora >= 0 ? r[iHora] : "",
          local: iLocal >= 0 ? r[iLocal] : "",
          logoLocal: iLogoLocal >= 0 ? r[iLogoLocal] : "",
          visitante: iVisit >= 0 ? r[iVisit] : "",
          logoVisit: iLogoVisit >= 0 ? r[iLogoVisit] : "",
          gl: iGL >= 0 ? r[iGL] : "",
          gv: iGV >= 0 ? r[iGV] : "",
          estado: iEstado >= 0 ? r[iEstado] : ""
        };
      });
      renderCards("listaPartidos", items);
    } catch (err) { console.warn("Error Partidos", err); }

    // CLASIFICACIÓN
    try {
      const [rowsA, rowsB] = await Promise.all([cargarCSV(urls.grupoA), cargarCSV(urls.grupoB)]);
      renderTabla("tablaGrupoA", rowsA);
      renderTabla("tablaGrupoB", rowsB);
    } catch (err) { console.warn("Error Tablas", err); }

    // JUGADOS
    try {
      const jugadosRows = await cargarCSV(urls.jugados);
      const hJ = jugadosRows[0].map(h => String(h||"").toLowerCase());
      jugadosState = jugadosRows.slice(1).filter(r => !filaVacia(r)).map(r => {
        const d = parseFechaFlexible(r[hJ.indexOf("fecha")]);
        return {
          iso: d ? toISO(d) : null,
          fechaTexto: d ? toDisplay(d) : r[hJ.indexOf("fecha")],
          fechaObj: d,
          local: r[hJ.indexOf("equipo local")] || r[hJ.indexOf("local")],
          logoLocal: r[hJ.indexOf("logo local")],
          visitante: r[hJ.indexOf("equipo visitante")] || r[hJ.indexOf("visitante")],
          logoVisit: r[hJ.indexOf("logo visitante")],
          gl: r[hJ.indexOf("goles local")] || "0",
          gv: r[hJ.indexOf("goles visitante")] || "0",
          vs: "VS"
        };
      });
      jugadosState.sort((a,b) => (b.fechaObj || 0) - (a.fechaObj || 0));
      renderCards("listaJugados", jugadosState);
    } catch (err) { console.warn("Error Jugados", err); }

  } catch (err) { console.error("Error General:", err); }
  finally { actualizarUltimaActualizacion(); }
}

/************************************************
 * NAVEGACIÓN Y PERSISTENCIA (localStorage)
 ************************************************/
function showSection(id) {
  seccionActual = id;
  localStorage.setItem("ultimaSeccion", id); // Guardar sección

  const sections = ["inicio","partidos","clasificacion","jugados","octavos"];
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle("hidden", s !== id);
  });

  document.querySelectorAll("#mainNav a").forEach(a => {
    a.classList.toggle("active", a.dataset.section === id);
  });

  if (id === "octavos" && typeof cargarOctavos === "function") cargarOctavos();
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("#mainNav a");
  if (!a) return;
  e.preventDefault();
  const section = a.dataset.section || a.getAttribute("href").replace("#","");
  showSection(section);
});

/************************************************
 * INICIALIZACIÓN OPTIMIZADA
 ************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // 1. PRIMERO: Decidir qué sección mostrar (antes de cargar datos)
  // Esto evita que se vea "todo junto" al refrescar
  const seccionGuardada = localStorage.getItem("ultimaSeccion") || "inicio";
  
  // Aplicamos la visibilidad de inmediato
  showSection(seccionGuardada);

  // 2. DESPUÉS: Cargamos los datos en segundo plano
  try {
    // Ejecutamos las cargas
    await Promise.all([
      cargarTodo(),
      cargarInicio()
    ]);
    
    // Si la sección era octavos, la cargamos específicamente
    if (seccionGuardada === "octavos" && typeof cargarOctavos === "function") {
      await cargarOctavos();
    }
  } catch (error) {
    console.error("Error al cargar datos iniciales:", error);
  }

  // 3. Configurar eventos de filtros (se mantienen igual)
  document.getElementById("btnFiltrarJugados")?.addEventListener("click", () => {
    const valor = document.getElementById("fechaFiltro").value;
    renderCards("listaJugados", valor ? jugadosState.filter(it => it.iso === valor) : jugadosState);
  });

  document.getElementById("btnResetFiltro")?.addEventListener("click", () => {
    document.getElementById("fechaFiltro").value = "";
    renderCards("listaJugados", jugadosState);
  });

  actualizarUltimaActualizacion();
});

// Modificamos ligeramente showSection para ser más agresivo con la limpieza
function showSection(id) {
  seccionActual = id;
  localStorage.setItem("ultimaSeccion", id);

  const sections = ["inicio","partidos","clasificacion","jugados","octavos"];
  
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) {
      // Forzamos el estilo directamente para evitar conflictos con CSS
      if (s === id) {
        el.classList.remove("hidden");
        el.style.display = "block"; 
      } else {
        el.classList.add("hidden");
        el.style.display = "none";
      }
    }
  });

  document.querySelectorAll("#mainNav a").forEach(a => {
    a.classList.toggle("active", a.dataset.section === id);
  });

  if (id === "octavos" && typeof cargarOctavos === "function") cargarOctavos();
}