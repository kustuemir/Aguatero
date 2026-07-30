// ---------- SUPABASE (login / cuentas) ----------
const SUPABASE_URL = 'https://gpchmuhxqmpwjrrtbsgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwY2htdWh4cW1wd2pycnRic2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODcyMjQsImV4cCI6MjEwMDg2MzIyNH0.9KQksogtzzhb9uzdAAdHOmuNWnMTHa0PUMR3wDJCgG4';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- SINCRONIZACIÓN CON SUPABASE (respaldo en la nube) ----------
// Todas las funciones son silenciosas: si no hay internet, no interrumpen al usuario.
// Los datos se guardan igual en el celular (localStorage + IndexedDB).

function clienteToSupabase(c){
  return {
    id: c.id,
    user_id: usuarioActual.id,
    codigo: c.codigo,
    nombre: c.nombre,
    telefono: c.telefono || '',
    direccion: c.direccion || '',
    precio: c.precio || 0,
    precio10: c.precio10 || 0,
    precio_disp: c.precioDisp || 0,
    dias: c.dias || [],
    saldo: c.saldo || 0,
    envases_pendientes: c.envasesPendientes || 0,
    orden_por_dia: c.ordenPorDia || {}
  };
}

function clienteFromSupabase(row, movimientos){
  return {
    id: row.id,
    codigo: row.codigo || 0,
    nombre: row.nombre,
    telefono: row.telefono || '',
    direccion: row.direccion || '',
    precio: parseFloat(row.precio) || 0,
    precio10: parseFloat(row.precio10) || 0,
    precioDisp: parseFloat(row.precio_disp) || 0,
    dias: row.dias || [],
    saldo: parseFloat(row.saldo) || 0,
    envasesPendientes: row.envases_pendientes || 0,
    ordenPorDia: row.orden_por_dia || {},
    historial: movimientos || []
  };
}

function movimientoToSupabase(entry, clienteId){
  return {
    id: entry.id,
    user_id: usuarioActual.id,
    cliente_id: clienteId,
    tipo: entry.tipo,
    fecha_iso: entry.fechaISO,
    hora: entry.hora || '',
    b20: entry.b20 || 0,
    b10: entry.b10 || 0,
    disp: entry.disp || 0,
    bidones: entry.bidones || 0,
    envases: entry.envases || 0,
    costo: entry.costo || 0,
    forma_pago: entry.formaPago || '',
    monto_pagado: entry.montoPagado || 0,
    transferencia_confirmada: entry.transferenciaConfirmada || false
  };
}

function movimientoFromSupabase(row){
  return {
    id: row.id,
    tipo: row.tipo,
    fechaISO: row.fecha_iso,
    hora: row.hora || '',
    b20: row.b20 || 0,
    b10: row.b10 || 0,
    disp: row.disp || 0,
    bidones: row.bidones || 0,
    envases: row.envases || 0,
    costo: parseFloat(row.costo) || 0,
    formaPago: row.forma_pago || '',
    montoPagado: parseFloat(row.monto_pagado) || 0,
    transferenciaConfirmada: row.transferencia_confirmada || false
  };
}

// Subir un cliente a Supabase (crear o actualizar)
async function syncCliente(c){
  if(!usuarioActual) return;
  try{
    const { error } = await sb.from('clientes').upsert(clienteToSupabase(c));
    if(error) console.log('Sync cliente error:', error.message);
  }catch(e){ /* sin internet, silencioso */ }
}

// Borrar un cliente de Supabase (borra sus movimientos en cascada)
async function syncBorrarCliente(clienteId){
  if(!usuarioActual) return;
  try{
    await sb.from('movimientos').delete().eq('cliente_id', clienteId);
    await sb.from('clientes').delete().eq('id', clienteId);
  }catch(e){ /* silencioso */ }
}

// Subir un movimiento a Supabase
async function syncMovimiento(entry, clienteId){
  if(!usuarioActual) return;
  try{
    const { error } = await sb.from('movimientos').insert(movimientoToSupabase(entry, clienteId));
    if(error) console.log('Sync movimiento error:', error.message);
  }catch(e){ /* silencioso */ }
}

// Borrar un movimiento de Supabase (cuando se elimina o deshace)
async function syncBorrarMovimiento(entryId){
  if(!usuarioActual) return;
  try{
    await sb.from('movimientos').delete().eq('id', entryId);
  }catch(e){ /* silencioso */ }
}

// Actualizar un movimiento en Supabase (ej: confirmar transferencia)
async function syncActualizarMovimiento(entry, clienteId){
  if(!usuarioActual) return;
  try{
    await sb.from('movimientos').update(movimientoToSupabase(entry, clienteId)).eq('id', entry.id);
  }catch(e){ /* silencioso */ }
}

// Subir el stock del camión
async function syncStock(){
  if(!usuarioActual) return;
  try{
    const { error } = await sb.from('stock_camion').upsert({
      user_id: usuarioActual.id,
      b20: stockCamion.b20,
      b10: stockCamion.b10,
      disp: stockCamion.disp
    });
    if(error) console.log('Sync stock error:', error.message);
  }catch(e){ /* silencioso */ }
}

// Subir resumen diario
async function syncResumenDiario(){
  if(!usuarioActual) return;
  const hoy = todayISO();
  try{
    const { error } = await sb.from('resumenes_diarios').upsert({
      user_id: usuarioActual.id,
      fecha: hoy,
      venta: ventaHoy,
      efectivo: efectivoHoy,
      transferencia: transferenciaHoy,
      deuda: deudaGeneradaHoy,
      envases_entregados: envasesEntregadosHoy,
      envases_recibidos: envasesRecibidosHoy,
      b20_vendidos: b20VendidosHoy,
      b10_vendidos: b10VendidosHoy,
      disp_vendidos: dispVendidosHoy,
      visitas: visitasHoy.size,
      hora: new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})
    }, { onConflict: 'user_id,fecha' });
    if(error) console.log('Sync resumen error:', error.message);
  }catch(e){ /* silencioso */ }
}

// BAJAR TODOS LOS DATOS DE SUPABASE (al iniciar sesión en un celular nuevo)
async function descargarDatosSupabase(){
  if(!usuarioActual) return;
  try{
    // Traer clientes
    const { data: clientesData, error: errC } = await sb.from('clientes').select('*').eq('user_id', usuarioActual.id);
    if(errC || !clientesData || clientesData.length === 0) return; // no hay datos en la nube todavía

    // Traer movimientos
    const { data: movsData, error: errM } = await sb.from('movimientos').select('*').eq('user_id', usuarioActual.id);

    // Traer stock
    const { data: stockData } = await sb.from('stock_camion').select('*').eq('user_id', usuarioActual.id).maybeSingle();

    // Agrupar movimientos por cliente
    const movsPorCliente = {};
    if(movsData){
      movsData.forEach(m => {
        if(!movsPorCliente[m.cliente_id]) movsPorCliente[m.cliente_id] = [];
        movsPorCliente[m.cliente_id].push(movimientoFromSupabase(m));
      });
    }

    // Reconstruir estado
    clientes = clientesData.map(row => clienteFromSupabase(row, movsPorCliente[row.id] || []));
    contadorClientes = clientes.reduce((max, c) => Math.max(max, c.codigo), 0);

    if(stockData){
      stockCamion = { b20: stockData.b20 || 0, b10: stockData.b10 || 0, disp: stockData.disp || 0 };
    }

    guardarEstado();
    renderTodo();
    console.log('Datos descargados de Supabase:', clientes.length, 'clientes');
  }catch(e){
    console.log('No se pudo descargar de Supabase:', e);
  }
}



let usuarioActual = null; // { id, email } una vez logueado

function ocultarMensajesLogin(){
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginInfo').style.display = 'none';
}

function mostrarErrorLogin(msg){
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('loginInfo').style.display = 'none';
}

function mostrarInfoLogin(msg){
  const el = document.getElementById('loginInfo');
  el.textContent = msg;
  el.style.display = 'block';
  document.getElementById('loginError').style.display = 'none';
}

async function accionLogin(){
  ocultarMensajesLogin();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if(!email || !password){ mostrarErrorLogin('Completá el email y la contraseña.'); return; }

  const boton = document.getElementById('btnLoginAccion');
  boton.disabled = true;
  boton.textContent = 'Un momento...';

  try{
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error){ mostrarErrorLogin(traducirErrorSupabase(error)); return; }
    onLoginExitoso(data.session);
  }catch(e){
    mostrarErrorLogin('No se pudo conectar. Revisá que tengas internet e intentá de nuevo.');
  }finally{
    boton.disabled = false;
    boton.textContent = 'Ingresar';
  }
}

function traducirErrorSupabase(error){
  const msg = error.message || '';
  if(msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.';
  if(msg.includes('User already registered')) return 'Ya existe una cuenta con ese email. Probá "Ingresar".';
  if(msg.includes('Password should be')) return 'La contraseña es muy corta (mínimo 6 caracteres).';
  return 'Ocurrió un error: ' + msg;
}

// ---------- RECUPERAR CONTRASEÑA ----------
async function recuperarPassword(){
  ocultarMensajesLogin();
  const email = document.getElementById('loginEmail').value.trim();

  if(!email){
    mostrarErrorLogin('Escribí tu email arriba y después tocá "¿Olvidaste tu contraseña?".');
    return;
  }

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if(error){
      mostrarErrorLogin(traducirErrorSupabase(error));
      return;
    }
    mostrarInfoLogin('Te enviamos un email con un link para cambiar tu contraseña. Revisá tu casilla (y la carpeta de spam).');
  } catch(e){
    mostrarErrorLogin('No se pudo conectar. Revisá tu conexión a internet.');
  }
}



function onLoginExitoso(session){
  usuarioActual = { id: session.user.id, email: session.user.email };
  const nombreMarca = session.user.user_metadata && session.user.user_metadata.nombre_marca;
  usuarioActual.nombreMarca = nombreMarca || '';

  document.getElementById('pantallaLogin').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  inicializarAppLuegoDeLogin();
  verificarSuscripcion();
  descargarDatosSupabase();

  if(!nombreMarca){
    setTimeout(()=>{ abrirModal('modalNombreMarca'); }, 300);
  } else {
    actualizarNombreMostrado();
    setTimeout(mostrarOnboardingSiCorresponde, 300);
  }
}

function actualizarNombreMostrado(){
  const el = document.getElementById('nombreMarcaMostrado');
  if(el) el.textContent = usuarioActual.nombreMarca || usuarioActual.email;
}

// ---------- CHEQUEO DE SUSCRIPCION ----------
async function verificarSuscripcion(){
  try{
    const { data, error } = await sb.from('suscripciones').select('*').eq('user_id', usuarioActual.id).maybeSingle();
    if(error || !data) return; // sin fila todavía = etapa de prueba, lo dejamos entrar

    const vencida = data.estado === 'vencida' || data.estado === 'cancelada' ||
      (data.fecha_vencimiento && new Date(data.fecha_vencimiento) < new Date());

    if(vencida){
      document.getElementById('textoSuscripcionBloqueada').textContent =
        'Tu suscripción' + (data.fecha_vencimiento ? ' venció el ' + isoAFechaLabel(data.fecha_vencimiento) : ' no está activa') + '. Renovala para seguir usando Aguatero.';
      document.getElementById('linkPagoSuscripcion').href = 'https://www.mercadopago.com.ar/'; // TODO: reemplazar por el link real de suscripción
      document.getElementById('pantallaSuscripcionBloqueada').style.display = 'flex';
    }
  }catch(e){
    // sin internet no se puede chequear: lo dejamos seguir trabajando offline con lo que ya tiene
  }
}

async function guardarNombreMarca(){
  const valor = document.getElementById('inputNombreMarca').value.trim();
  if(!valor){ alert('Escribí un nombre o el nombre de tu marca de agua.'); return; }
  try{
    await sb.auth.updateUser({ data: { nombre_marca: valor } });
    usuarioActual.nombreMarca = valor;
    actualizarNombreMostrado();
    cerrarModal('modalNombreMarca');
    setTimeout(mostrarOnboardingSiCorresponde, 300);
  }catch(e){
    alert('No se pudo guardar (revisá tu conexión). Lo podés cambiar después desde el menú.');
  }
}

async function cerrarSesion(){
  await sb.auth.signOut();
  usuarioActual = null;
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('pantallaLogin').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
}

// Al abrir la app, nos fijamos si ya había una sesión iniciada (para no pedir
// el usuario y contraseña cada vez que se abre, sin necesitar internet siempre)
async function verificarSesionAlAbrir(){
  try{
    const { data } = await sb.auth.getSession();
    if(data.session){
      onLoginExitoso(data.session);
    }
  }catch(e){
    // sin internet o sin sesión: se queda en la pantalla de login
  }
}
verificarSesionAlAbrir();

// ---------- ESTADO ----------
const CLAVE_STORAGE_BASE = 'aguacontrol_estado_v1';
function claveStorageActual(){
  return CLAVE_STORAGE_BASE + '_' + (usuarioActual ? usuarioActual.id : 'sin_sesion');
}
const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

let clientes = [];
let contadorClientes = 0;
let clienteSeleccionado = null;
let clienteStockId = null;
let diaSeleccionado = diaDeHoy();
let searchTerm = '';
let searchType = 'nombre';

let ventaHoy = 0;
let cobradoHoy = 0;
let efectivoHoy = 0;
let transferenciaHoy = 0;
let entregadoHoy = 0;
let deudaGeneradaHoy = 0;
let envasesEntregadosHoy = 0;
let envasesRecibidosHoy = 0;
let b20VendidosHoy = 0;
let b10VendidosHoy = 0;
let dispVendidosHoy = 0;
let visitasHoy = new Set();
let fechaContadores = todayISO();

// Stock de bidones que cargás en el camión antes de salir a repartir
let stockCamion = { b20: 0, b10: 0, disp: 0 };

// Archivo de repartos cerrados, uno por fecha (para el reporte semanal)
let resumenesDiarios = {};

function diaDeHoy(){
  return DIAS[(new Date().getDay()+6)%7];
}

function todayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function isoAFechaLabel(iso){
  if(!iso || typeof iso !== 'string' || iso.indexOf('-') === -1) return '-';
  const [y,m,d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

function actualizarFechaHoyLabel(){
  const dias = DIAS;
  const hoy = new Date();
  const nombreDia = dias[(hoy.getDay()+6)%7];
  document.getElementById('fechaHoyLabel').textContent = nombreDia + ' ' + isoAFechaLabel(todayISO());
}

function generarId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function verificarResetDiario(){
  if(fechaContadores !== todayISO()){
    ventaHoy = 0; cobradoHoy = 0; efectivoHoy = 0; transferenciaHoy = 0;
    entregadoHoy = 0; deudaGeneradaHoy = 0; envasesEntregadosHoy = 0; envasesRecibidosHoy = 0;
    b20VendidosHoy = 0; b10VendidosHoy = 0; dispVendidosHoy = 0;
    visitasHoy = new Set();
    fechaContadores = todayISO();
  }
}

// ---------- GUARDADO EN EL CELULAR (localStorage) ----------
// Esto guarda los datos en el navegador de tu teléfono para que no se
// pierdan al cerrar la app. Funciona cuando abrís el archivo directamente
// en tu celular (Chrome, Spck, etc). En la vista previa del chat puede no
// conservarse porque el chat usa un entorno temporal.
// ---------- MEMORIA DOBLE: localStorage + IndexedDB de respaldo ----------
// Si el navegador/atajo borra localStorage, tratamos de recuperar de IndexedDB
const DB_NOMBRE = 'aguacontrol_db';
const DB_ALMACEN = 'estado';
let promesaDB = null;

function abrirBaseRespaldo(){
  if(promesaDB) return promesaDB;
  promesaDB = new Promise((resolve)=>{
    if(!window.indexedDB){ resolve(null); return; }
    try{
      const req = indexedDB.open(DB_NOMBRE, 1);
      req.onupgradeneeded = function(e){
        const db = e.target.result;
        if(!db.objectStoreNames.contains(DB_ALMACEN)) db.createObjectStore(DB_ALMACEN);
      };
      req.onsuccess = function(e){ resolve(e.target.result); };
      req.onerror = function(){ resolve(null); };
    }catch(e){ resolve(null); }
  });
  return promesaDB;
}

function guardarEnBaseRespaldo(estado){
  abrirBaseRespaldo().then(db=>{
    if(!db) return;
    try{
      const tx = db.transaction(DB_ALMACEN, 'readwrite');
      tx.objectStore(DB_ALMACEN).put(estado, 'estadoActual');
    }catch(e){ /* silencioso */ }
  });
}

function cargarDeBaseRespaldo(){
  return abrirBaseRespaldo().then(db=>{
    if(!db) return null;
    return new Promise(resolve=>{
      try{
        const tx = db.transaction(DB_ALMACEN, 'readonly');
        const req = tx.objectStore(DB_ALMACEN).get('estadoActual');
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror = function(){ resolve(null); };
      }catch(e){ resolve(null); }
    });
  });
}

function construirEstadoActual(){
  return {
    clientes, contadorClientes, diaSeleccionado,
    ventaHoy, cobradoHoy, efectivoHoy, transferenciaHoy, entregadoHoy,
    deudaGeneradaHoy, envasesEntregadosHoy, envasesRecibidosHoy,
    b20VendidosHoy, b10VendidosHoy, dispVendidosHoy,
    visitasHoy: Array.from(visitasHoy),
    fechaContadores, stockCamion, resumenesDiarios,
    clientesFueraRutaHoy: Array.from(clientesFueraRutaHoy),
    ultimaModificacion: Date.now()
  };
}

function aplicarEstadoDesdeObjeto(estado){
  clientes = estado.clientes || [];
  contadorClientes = estado.contadorClientes || 0;
  diaSeleccionado = estado.diaSeleccionado || diaDeHoy();
  ventaHoy = estado.ventaHoy || 0;
  cobradoHoy = estado.cobradoHoy || 0;
  efectivoHoy = estado.efectivoHoy || 0;
  transferenciaHoy = estado.transferenciaHoy || 0;
  entregadoHoy = estado.entregadoHoy || 0;
  deudaGeneradaHoy = estado.deudaGeneradaHoy || 0;
  envasesEntregadosHoy = estado.envasesEntregadosHoy || 0;
  envasesRecibidosHoy = estado.envasesRecibidosHoy || 0;
  b20VendidosHoy = estado.b20VendidosHoy || 0;
  b10VendidosHoy = estado.b10VendidosHoy || 0;
  dispVendidosHoy = estado.dispVendidosHoy || 0;
  visitasHoy = new Set(estado.visitasHoy || []);
  fechaContadores = estado.fechaContadores || todayISO();
  stockCamion = estado.stockCamion || { b20: 0, b10: 0, disp: 0 };
  resumenesDiarios = estado.resumenesDiarios || {};
  clientesFueraRutaHoy = new Set(estado.clientesFueraRutaHoy || []);
}

function guardarEstado(){
  const estado = construirEstadoActual();
  try{
    localStorage.setItem(claveStorageActual(), JSON.stringify(estado));
  }catch(e){
    console.log('No se pudo guardar en localStorage:', e);
  }
  guardarEnBaseRespaldo(estado);
  // Sincronizar con Supabase (silencioso, solo si hay internet)
  if(usuarioActual){
    syncStock();
    syncResumenDiario();
  }
}

function cargarEstado(){
  let cargadoOk = false;
  try{
    const guardado = localStorage.getItem(claveStorageActual());
    if(guardado){
      aplicarEstadoDesdeObjeto(JSON.parse(guardado));
      cargadoOk = true;
    }
  }catch(e){
    console.log('No se pudo cargar el estado guardado:', e);
  }
  verificarResetDiario();

  if(!cargadoOk){
    // La memoria principal vino vacía (se borró). Probamos recuperar
    // de la memoria de respaldo (IndexedDB), que es más difícil de borrar.
    cargarDeBaseRespaldo().then(estado=>{
      if(estado){
        aplicarEstadoDesdeObjeto(estado);
        verificarResetDiario();
        guardarEstado();
        renderTodo();
        const fechaRespaldo = estado.ultimaModificacion
          ? new Date(estado.ultimaModificacion).toLocaleString('es-AR')
          : 'una fecha anterior';
        alert(`⚠️ Se recuperaron datos de una copia de seguridad automática (del ${fechaRespaldo}), porque la memoria principal del celular se vació.\n\nRevisá que esté todo correcto — si ves algo raro o viejo (como clientes que ya habías borrado), podés eliminarlo de nuevo tranquilo.`);
      }
    });
  }
}

// ---------- NAVEGACION DE TABS ----------
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.tab).classList.add('active');
    cerrarMenus();
    renderTodo();
  });
});

// ---------- MENUS Y PANELES DESPLEGABLES ----------
function cerrarMenus(){
  document.getElementById('menuDropdown').classList.remove('activo');
  document.getElementById('diaDropdown').classList.remove('activo');
}
function toggleMenu(){
  document.getElementById('diaDropdown').classList.remove('activo');
  document.getElementById('menuDropdown').classList.toggle('activo');
}
function togglePanel(id){
  document.getElementById('menuDropdown').classList.remove('activo');
  const otro = id === 'diaDropdown' ? null : 'diaDropdown';
  if(id === 'panelBusqueda'){
    document.getElementById('diaDropdown').classList.remove('activo');
    document.getElementById('panelBusqueda').classList.toggle('activo');
  } else {
    document.getElementById('panelBusqueda').classList.remove('activo');
    document.getElementById(id).classList.toggle('activo');
  }
}

function mostrarEstadisticas(){
  cerrarMenus();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-estadisticas').classList.add('active');
  renderEstadisticas();
}
function volverDeEstadisticas(){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-porVisitar').classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="porVisitar"]').classList.add('active');
}

// Selector de dia (icono calendario)
function renderSelectorDiaVista(){
  const cont = document.getElementById('selectorDiaVista');
  cont.innerHTML = '';
  DIAS.forEach(dia=>{
    const chip = document.createElement('button');
    chip.className = 'dia-chip' + (dia===diaConsulta ? ' activo':'');
    chip.textContent = dia;
    chip.onclick = ()=>{
      abrirConsultaDia(dia);
      cerrarMenus();
    };
    cont.appendChild(chip);
  });
}

// Buscador
function renderFiltroTabs(){
  const cont = document.getElementById('filtroTabs');
  cont.innerHTML = '';
  [['nombre','Nombre'],['domicilio','Domicilio'],['codigo','Código']].forEach(([valor,label])=>{
    const btn = document.createElement('button');
    btn.className = 'filtro-tab' + (searchType===valor ? ' activo':'');
    btn.textContent = label;
    btn.onclick = ()=>{ searchType = valor; renderFiltroTabs(); renderTodo(); };
    cont.appendChild(btn);
  });
}
// ---------- ONBOARDING PRIMERA VEZ ----------
const PASOS_ONBOARDING = [
  { titulo: '📇 1. Cargá tus clientes', texto: 'Tocá el botón + para agregar un cliente, o "Importar clientes desde Contactos" en el menú para traerlos de tu agenda.' },
  { titulo: '🚚 2. Cargá el stock del camión', texto: 'Antes de salir a repartir, andá a ☰ → "Stock del camión" y anotá cuántos bidones sacaste (20L, 10-12L, dispensers).' },
  { titulo: '📦 3. Registrá cada venta', texto: 'En "Por visitar", tocá "Stock" en la tarjeta del cliente para anotar lo que te compró y cómo te pagó.' },
  { titulo: '🔒 4. Cerrá el reparto al final del día', texto: 'En ☰ → "Resumen del día" tocá "Cerrar reparto del día" para guardar el total y dejar todo listo para mañana.' }
];
let pasoOnboardingActual = 0;

function mostrarOnboardingSiCorresponde(){
  if(localStorage.getItem('aguatero_onboarding_visto') === '1') return;
  pasoOnboardingActual = 0;
  renderPasoOnboarding();
  abrirModal('modalOnboarding');
}

function renderPasoOnboarding(){
  const paso = PASOS_ONBOARDING[pasoOnboardingActual];
  document.getElementById('onboardingContenido').innerHTML =
    `<h2>${paso.titulo}</h2><p style="font-size:0.9em; color:#666;">${paso.texto}</p>` +
    `<p style="font-size:0.75em; color:#999; text-align:center;">${pasoOnboardingActual+1} / ${PASOS_ONBOARDING.length}</p>`;
  document.getElementById('btnOnboardingSiguiente').textContent =
    (pasoOnboardingActual === PASOS_ONBOARDING.length - 1) ? 'Entendido' : 'Siguiente';
}

function siguienteOnboarding(){
  pasoOnboardingActual++;
  if(pasoOnboardingActual >= PASOS_ONBOARDING.length){
    cerrarOnboarding();
    return;
  }
  renderPasoOnboarding();
}

function cerrarOnboarding(){
  localStorage.setItem('aguatero_onboarding_visto', '1');
  cerrarModal('modalOnboarding');
}

// ---------- INDICADOR SIN CONEXION ----------
function actualizarIndicadorConexion(){
  const el = document.getElementById('indicadorSinConexion');
  if(!el) return;
  el.style.display = navigator.onLine ? 'none' : 'block';
}
window.addEventListener('online', actualizarIndicadorConexion);
window.addEventListener('offline', actualizarIndicadorConexion);
actualizarIndicadorConexion();

// ---------- MODO OSCURO ----------
function alternarModoOscuro(){
  const activo = document.body.classList.toggle('oscuro');
  localStorage.setItem('aguatero_modo_oscuro', activo ? '1' : '0');
  actualizarTextoModoOscuro();
  cerrarMenus();
}

function actualizarTextoModoOscuro(){
  const boton = document.getElementById('btnModoOscuro');
  if(!boton) return;
  boton.textContent = document.body.classList.contains('oscuro') ? '☀️ Modo claro' : '🌙 Modo oscuro';
}

if(localStorage.getItem('aguatero_modo_oscuro') === '1'){
  document.body.classList.add('oscuro');
}
actualizarTextoModoOscuro();

function onBuscar(){
  searchTerm = document.getElementById('inputBusqueda').value.trim();
  renderTodo();
}

// ---------- BUSQUEDA POR VOZ ----------
function buscarPorVoz(){
  const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Reconocimiento){
    alert('Tu navegador no permite la búsqueda por voz. Probá escribiendo en el buscador, o usá Chrome actualizado.');
    return;
  }
  const boton = document.getElementById('btnBusquedaVoz');
  const reconocimiento = new Reconocimiento();
  reconocimiento.lang = 'es-AR';
  reconocimiento.interimResults = false;
  reconocimiento.maxAlternatives = 1;

  boton.textContent = '🔴';
  boton.disabled = true;

  reconocimiento.onresult = function(evento){
    const texto = evento.results[0][0].transcript;
    document.getElementById('inputBusqueda').value = texto;
    onBuscar();
  };
  reconocimiento.onerror = function(){
    alert('No se pudo escuchar bien. Probá de nuevo, o escribí en el buscador.');
  };
  reconocimiento.onend = function(){
    boton.textContent = '🎤';
    boton.disabled = false;
  };

  try{
    reconocimiento.start();
  }catch(e){
    boton.textContent = '🎤';
    boton.disabled = false;
  }
}
function pasaFiltro(c){
  if(!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  if(searchType==='nombre') return c.nombre.toLowerCase().includes(term);
  if(searchType==='domicilio') return (c.direccion||'').toLowerCase().includes(term);
  if(searchType==='codigo') return String(c.codigo).includes(term);
  return true;
}

// ---------- MODAL NUEVO CLIENTE ----------
// ---------- CARGAR REPARTO DEL DIA ----------

// ---------- IMPORTAR CLIENTES DESDE CONTACTOS (agenda del celular) ----------
async function importarDesdeContactos(){
  cerrarMenus();

  if(!('contacts' in navigator && 'ContactsManager' in window)){
    alert('Tu celular o tu navegador no permite esta función todavía.\n\nSolo anda en Chrome para Android (versión 80 o más nueva). Si estás en otro navegador o en iPhone, tenés que cargar los clientes a mano con el botón +.');
    return;
  }

  try{
    const propiedades = ['name','tel'];
    const contactos = await navigator.contacts.select(propiedades, {multiple:true});
    if(!contactos || contactos.length === 0) return;

    let importados = 0;
    contactos.forEach(ct=>{
      const nombreCompleto = (ct.name && ct.name[0]) ? ct.name[0].trim() : '';
      if(!nombreCompleto) return;
      const telefono = (ct.tel && ct.tel[0]) ? ct.tel[0].replace(/[^0-9]/g,'') : '';

      // Muchos guardan el nombre como "Cliente - Dirección" o "Cliente, Dirección"
      // Probamos separarlo así; si no hay separador, todo queda en el nombre.
      let nombre = nombreCompleto;
      let direccion = '';
      const separadores = [' - ', ' – ', ', '];
      for(const sep of separadores){
        if(nombreCompleto.includes(sep)){
          const partes = nombreCompleto.split(sep);
          nombre = partes[0].trim();
          direccion = partes.slice(1).join(sep).trim();
          break;
        }
      }

      contadorClientes++;
      const cliente = {
        id: generarId(),
        codigo: contadorClientes,
        nombre,
        telefono,
        direccion,
        precio: 5000,
        dias: [],
        saldo: 0,
        envasesPendientes: 0,
        historial: [],
        ordenPorDia: {}
      };
      clientes.push(cliente);
      importados++;
    });

    guardarEstado();
    renderTodo();
    alert(`Se importaron ${importados} contactos ✅\n\nTodavía no tienen día de reparto asignado, así que los vas a encontrar en la pestaña "Fuera de reparto". Entrá a cada uno (✏️ Editar datos) para completar dirección (si no se separó bien), precio y elegir sus días.`);
  }catch(e){
    // el usuario canceló el selector, no hacemos nada
  }
}

function abrirModalCargarReparto(){
  cerrarMenus();
  const cont = document.getElementById('selectorDiaActivo');
  cont.innerHTML = '';
  DIAS.forEach(dia=>{
    const chip = document.createElement('button');
    chip.className = 'dia-chip' + (dia===diaSeleccionado ? ' activo':'');
    chip.textContent = dia;
    chip.onclick = ()=>{
      diaSeleccionado = dia;
      verificarResetDiario();
      cerrarModal('modalCargarReparto');
      renderTodo();
    };
    cont.appendChild(chip);
  });
  abrirModal('modalCargarReparto');
}

// ---------- CONSULTAR CLIENTES DE OTRO DIA ----------
let diaConsulta = null;

function abrirConsultaDia(dia){
  diaConsulta = dia;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-consultaDia').classList.add('active');
  document.getElementById('tituloConsultaDia').textContent = 'Clientes de ' + dia;
  renderConsultaDia();
}

function renderConsultaDia(){
  if(!diaConsulta){
    document.getElementById('listaConsultaDia').innerHTML = '';
    return;
  }
  const cont = document.getElementById('listaConsultaDia');
  const filtrados = clientes.filter(c=>c.dias.includes(diaConsulta) && pasaFiltro(c));
  if(filtrados.length === 0){
    cont.innerHTML = '<div class="empty-msg">Sin clientes para ese día</div>';
    return;
  }
  cont.innerHTML = filtrados.map(c=>{
    const yaAgregado = clientesFueraRutaHoy.has(c.id);
    const puedeAgregar = diaConsulta !== diaSeleccionado;
    return `
    <div class="card">
      <div onclick="abrirDetalle('${c.id}')">
        <h3>${c.codigo} - ${c.nombre}</h3>
        <div class="row"><span>${c.direccion || ''}</span></div>
        <div class="row"><span>Saldo:</span><span class="${c.saldo>0?'deuda':'saldo-ok'}">$${c.saldo.toFixed(0)}</span></div>
        <div class="row"><span>Último movimiento:</span><span>${c.historial.length > 0 ? c.historial[c.historial.length-1].fechaISO : 'Nunca'}</span></div>
      </div>
      ${(puedeAgregar && !yaAgregado) ? `<button class="btn chico naranja" style="margin-top:6px;" onclick="agregarAFueraDeReparto('${c.id}')">🚚➕ Agregar a fuera de reparto de hoy</button>` : ''}
      ${(puedeAgregar && yaAgregado) ? `<div class="row" style="color:var(--verde-pago); font-weight:bold; margin-top:6px;">✅ Ya está en fuera de reparto de hoy</div>` : ''}
    </div>
  `;
  }).join('');
}

function abrirModalNuevoCliente(){
  document.getElementById('tituloModalCliente').textContent = 'Nuevo cliente';
  document.getElementById('inputNombre').value = '';
  document.getElementById('inputTelefono').value = '';
  document.getElementById('inputDireccion').value = '';
  document.getElementById('inputPrecio').value = 5000;
  document.getElementById('inputPrecio10').value = 3000;
  document.getElementById('inputPrecioDisp').value = 8000;
  renderDiasSelector('diasClienteSelector', []);
  renderSelectDespuesDe();
  clienteSeleccionado = null;
  cerrarMenus();
  abrirModal('modalCliente');
}
document.getElementById('btnAgregar').addEventListener('click', abrirModalNuevoCliente);
document.getElementById('btnAgregarTop').addEventListener('click', abrirModalNuevoCliente);

function abrirModal(id){ document.getElementById(id).classList.add('active'); }
function cerrarModal(id){ document.getElementById(id).classList.remove('active'); }

function renderDiasSelector(contenedorId, diasActivos){
  const cont = document.getElementById(contenedorId);
  cont.innerHTML = '';
  DIAS.forEach(dia=>{
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'dia-chip' + (diasActivos.includes(dia) ? ' activo' : '');
    chip.textContent = dia;
    chip.onclick = ()=>{ chip.classList.toggle('activo'); };
    cont.appendChild(chip);
  });
}
function diasSeleccionadosDe(contenedorId){
  return Array.from(document.querySelectorAll('#'+contenedorId+' .dia-chip.activo')).map(c=>c.textContent);
}
function renderSelectDespuesDe(){
  const sel = document.getElementById('inputDespuesDe');
  sel.innerHTML = '<option value="">Al final del recorrido</option>';
  clientes.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.codigo + ' - ' + c.nombre;
    sel.appendChild(opt);
  });
}

// ---------- CRUD CLIENTES ----------
function guardarCliente(){
  const nombre = document.getElementById('inputNombre').value.trim();
  const telefono = document.getElementById('inputTelefono').value.trim();
  const direccion = document.getElementById('inputDireccion').value.trim();
  const precio = parseFloat(document.getElementById('inputPrecio').value) || 0;
  const precio10 = parseFloat(document.getElementById('inputPrecio10').value) || 0;
  const precioDisp = parseFloat(document.getElementById('inputPrecioDisp').value) || 0;
  const dias = diasSeleccionadosDe('diasClienteSelector');
  const despuesDe = document.getElementById('inputDespuesDe').value;

  if(!nombre){ alert('Poné un nombre para el cliente'); return; }
  if(dias.length === 0){ alert('Elegí al menos un día de reparto'); return; }

  let cliente;
  let esNuevo = !clienteSeleccionado;
  if(clienteSeleccionado){
    cliente = clientes.find(x=>x.id===clienteSeleccionado);
    cliente.nombre = nombre; cliente.telefono = telefono;
    cliente.direccion = direccion; cliente.precio = precio;
    cliente.precio10 = precio10; cliente.precioDisp = precioDisp;
    cliente.dias = dias;
    // Quitar orden de los días que ya no están seleccionados
    Object.keys(cliente.ordenPorDia).forEach(dia=>{
      if(!dias.includes(dia)) delete cliente.ordenPorDia[dia];
    });
  } else {
    contadorClientes++;
    cliente = {
      id: generarId(), codigo: contadorClientes, nombre, telefono, direccion, precio, precio10, precioDisp, dias,
      saldo: 0, envasesPendientes: 0, historial: [], ordenPorDia: {}
    };
    clientes.push(cliente);
  }

  // Solo asignamos orden en la ruta para los días nuevos (si ya tenía
  // orden en un día, lo respetamos y no lo movemos de lugar al editar)
  dias.forEach(dia=>{
    if(esNuevo || cliente.ordenPorDia[dia] === undefined){
      insertarEnRuta(cliente.id, dia, despuesDe);
    }
  });

  guardarEstado();
  syncCliente(cliente);
  cerrarModal('modalCliente');
  renderTodo();
}

function abrirEditarCliente(){
  const c = clientes.find(x=>x.id===clienteSeleccionado);
  if(!c) return;
  cerrarModal('modalDetalle');
  document.getElementById('tituloModalCliente').textContent = 'Editar cliente';
  document.getElementById('inputNombre').value = c.nombre;
  document.getElementById('inputTelefono').value = c.telefono || '';
  document.getElementById('inputDireccion').value = c.direccion || '';
  document.getElementById('inputPrecio').value = c.precio;
  document.getElementById('inputPrecio10').value = (c.precio10 !== undefined) ? c.precio10 : 3000;
  document.getElementById('inputPrecioDisp').value = (c.precioDisp !== undefined) ? c.precioDisp : 8000;
  renderDiasSelector('diasClienteSelector', c.dias);
  renderSelectDespuesDe();
  document.getElementById('inputDespuesDe').value = '';
  abrirModal('modalCliente');
}

function insertarEnRuta(clienteId, dia, despuesDeId){
  let lista = clientes
    .filter(c=>c.id!==clienteId && c.dias.includes(dia))
    .sort((a,b)=>(a.ordenPorDia[dia]||0)-(b.ordenPorDia[dia]||0))
    .map(c=>c.id);

  let insertIndex = lista.length;
  if(despuesDeId){
    const idx = lista.indexOf(despuesDeId);
    if(idx !== -1) insertIndex = idx+1;
  }
  lista.splice(insertIndex, 0, clienteId);

  lista.forEach((id,i)=>{
    const c = clientes.find(x=>x.id===id);
    c.ordenPorDia[dia] = i+1;
  });
}

function moverAlFinalDelDia(clienteId, dia){
  const c = clientes.find(x=>x.id===clienteId);
  if(!c || !c.dias.includes(dia)) return;
  const lista = clientes
    .filter(x=>x.id!==clienteId && x.dias.includes(dia))
    .sort((a,b)=>(a.ordenPorDia[dia]||0)-(b.ordenPorDia[dia]||0))
    .map(x=>x.id);
  lista.push(clienteId);
  lista.forEach((id,i)=>{
    const cli = clientes.find(x=>x.id===id);
    cli.ordenPorDia[dia] = i+1;
  });
}

function borrarCliente(){
  const c = clientes.find(x=>x.id===clienteSeleccionado);
  if(!c) return;
  document.getElementById('nombreAEliminar').textContent = c.codigo + ' - ' + c.nombre;
  abrirModal('modalConfirmarEliminar');
}

function confirmarBorrado(){
  const c = clientes.find(x=>x.id===clienteSeleccionado);
  ultimoClienteEliminado = c ? JSON.parse(JSON.stringify(c)) : null;
  syncBorrarCliente(clienteSeleccionado);
  clientes = clientes.filter(c=>c.id!==clienteSeleccionado);
  visitasHoy.delete(clienteSeleccionado);
  cerrarModal('modalConfirmarEliminar');
  cerrarModal('modalDetalle');
  renderTodo();
  mostrarBannerDeshacer(ultimoClienteEliminado ? ultimoClienteEliminado.nombre : '');
}

function mostrarBannerDeshacer(nombre){
  const banner = document.getElementById('bannerDeshacer');
  document.getElementById('bannerDeshacerTexto').textContent = 'Eliminaste a ' + nombre;
  banner.classList.add('activo');
  clearTimeout(window._deshacerTimeout);
  window._deshacerTimeout = setTimeout(()=>{
    banner.classList.remove('activo');
    ultimoClienteEliminado = null;
  }, 8000);
}

function deshacerEliminacion(){
  if(!ultimoClienteEliminado) return;
  clientes.push(ultimoClienteEliminado);
  syncCliente(ultimoClienteEliminado);
  ultimoClienteEliminado = null;
  document.getElementById('bannerDeshacer').classList.remove('activo');
  clearTimeout(window._deshacerTimeout);
  renderTodo();
}

function abrirDetalle(id){
  clienteSeleccionado = id;
  const c = clientes.find(x=>x.id===id);
  document.getElementById('nombreDetalle').textContent = c.codigo + ' - ' + c.nombre;
  document.getElementById('diasDetalle').textContent = c.dias.join(', ') || '-';
  document.getElementById('inputPago').value = '';

  const cont = document.getElementById('botonesContacto');
  const tel = (c.telefono || '').replace(/[^0-9]/g,'');
  if(tel){
    cont.innerHTML = `
      <a class="btn chico" style="text-decoration:none; text-align:center;" href="https://wa.me/${tel}">💬 WhatsApp</a>
      <a class="btn chico outline" style="text-decoration:none; text-align:center;" href="tel:${tel}">📞 Llamar</a>
    `;
  } else {
    cont.innerHTML = '';
  }

  renderDetalle(c);
  abrirModal('modalDetalle');
}

function renderDetalle(c){
  const saldoEl = document.getElementById('saldoDetalle');
  saldoEl.textContent = '$' + c.saldo.toFixed(0);
  saldoEl.className = c.saldo > 0 ? 'deuda' : 'saldo-ok';
  document.getElementById('envasesDetalle').textContent = c.envasesPendientes;

  const hist = document.getElementById('historialCliente');
  if(c.historial.length === 0){
    hist.innerHTML = '<div class="empty-msg">Sin movimientos todavía</div>';
  } else {
    hist.innerHTML = c.historial.slice().reverse().map(h=>
      `<div class="mov-item">
        <span>${formatearMovimiento(h)}</span>
        <span style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; font-size:0.75em;">
          <span>${isoAFechaLabel(h.fechaISO)}</span>
          <span>${h.hora || '-'}</span>
          <span style="display:flex; gap:4px; margin-top:2px;">
            ${(h.id && h.tipo === 'compra') ? `<button class="btn chico outline" style="padding:2px 8px;" onclick="abrirBoleta('${c.id}','${h.id}')">🧾</button>` : ''}
            ${(h.id && h.tipo !== 'pago') ? `<button class="btn chico outline" style="padding:2px 8px;" onclick="abrirEditarMovimiento('${c.id}','${h.id}')">✏️</button>` : ''}
          </span>
        </span>
      </div>`
    ).join('');
  }
}

// ---------- MODAL STOCK (registrar compra) ----------
function abrirStock(id){
  if(stockCamion.b20 <= 0 && stockCamion.b10 <= 0 && stockCamion.disp <= 0){
    alert('⚠️ Sin stock\n\nNo tenés bidones ni dispensers cargados en el camión.\n\nAndá a ☰ → "Stock del camión" y cargá lo que sacaste antes de empezar a vender.');
    return;
  }
  clienteStockId = id;
  const c = clientes.find(x=>x.id===id);
  document.getElementById('nombreStock').textContent = c.codigo + ' - ' + c.nombre;
  document.getElementById('saldoActualStock').textContent = '$' + c.saldo.toFixed(0);
  document.getElementById('bidonesPoderStock').textContent = c.envasesPendientes;
  document.getElementById('stkB20').value = '';
  document.getElementById('stkB10').value = '';
  document.getElementById('stkDisp').value = '';
  document.getElementById('stkEnvases').value = '';
  document.getElementById('stkEntregado').value = '';
  actualizarPreviewStock();
  renderHistorialStock(c);
  abrirModal('modalStock');
}

function ajustarCantidadStock(inputId, delta){
  const input = document.getElementById(inputId);
  const actual = parseInt(input.value) || 0;
  input.value = Math.max(0, actual + delta);
  actualizarPreviewStock();
}

function renderHistorialStock(c){
  const cont = document.getElementById('historialStock');
  if(!c.historial || c.historial.length === 0){
    cont.innerHTML = '<div class="empty-msg">Sin movimientos todavía</div>';
    return;
  }
  cont.innerHTML = c.historial.slice().reverse().map(h=>
    `<div class="mov-item">
      <span>${formatearMovimiento(h)}</span>
      <span style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; font-size:0.75em;">
        <span>${isoAFechaLabel(h.fechaISO)}</span>
        <span>${h.hora || '-'}</span>
        ${(h.id && h.tipo === 'compra') ? `<button class="btn chico outline" style="padding:2px 8px; margin-top:2px;" onclick="abrirBoleta('${c.id}','${h.id}')">🧾</button>` : ''}
      </span>
    </div>`
  ).join('');
}

function actualizarPreviewStock(){
  const c = clientes.find(x=>x.id===clienteStockId);
  if(!c) return;
  const b20 = parseInt(document.getElementById('stkB20').value) || 0;
  const b10 = parseInt(document.getElementById('stkB10').value) || 0;
  const disp = parseInt(document.getElementById('stkDisp').value) || 0;
  const total = b20*c.precio + b10*(c.precio10||0) + disp*(c.precioDisp||0);
  document.getElementById('stkPreview').textContent = '$' + total.toFixed(0);
}

function confirmarStock(tipo){
  const c = clientes.find(x=>x.id===clienteStockId);
  const b20 = parseInt(document.getElementById('stkB20').value) || 0;
  const b10 = parseInt(document.getElementById('stkB10').value) || 0;
  const disp = parseInt(document.getElementById('stkDisp').value) || 0;
  const envases = parseInt(document.getElementById('stkEnvases').value) || 0;
  if(b20 === 0 && b10 === 0 && disp === 0 && envases === 0) return;

  if(b20 > stockCamion.b20 || b10 > stockCamion.b10 || disp > stockCamion.disp){
    alert(`⚠️ Sin stock suficiente\n\nTe quedan: ${stockCamion.b20} de 20L, ${stockCamion.b10} de 10L, ${stockCamion.disp} dispensers.\n\nAjustá la cantidad o cargá más stock desde ☰ → "Stock del camión".`);
    return;
  }

  const costo = b20*c.precio + b10*(c.precio10||0) + disp*(c.precioDisp||0);
  const bidones = b20 + b10 + disp; // total de envases llenos entregados (para stock de envases pendientes)
  let montoPagado = 0;
  if(tipo === 'efectivo' || tipo === 'transferencia'){
    montoPagado = costo;
  } else if(tipo === 'entregado'){
    montoPagado = parseFloat(document.getElementById('stkEntregado').value) || 0;
  }

  const ahora = new Date();
  const entry = {
    id: generarId(),
    tipo: 'compra',
    fechaISO: todayISO(),
    hora: ahora.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}),
    b20, b10, disp, bidones, envases, costo,
    formaPago: tipo,
    montoPagado,
    transferenciaConfirmada: (tipo === 'transferencia_pendiente') ? false : undefined
  };
  c.historial.push(entry);
  aplicarEfectoMovimiento(c, entry);
  syncMovimiento(entry, c.id);
  syncCliente(c);

  stockCamion.b20 = Math.max(0, stockCamion.b20 - b20);
  stockCamion.b10 = Math.max(0, stockCamion.b10 - b10);
  stockCamion.disp = Math.max(0, stockCamion.disp - disp);
  syncStock();
  syncResumenDiario();

  visitasHoy.add(c.id);
  moverAlFinalDelDia(c.id, diaSeleccionado);

  cerrarModal('modalStock');
  renderTodo();
}

function marcarNoCompra(){
  const c = clientes.find(x=>x.id===clienteStockId);
  const ahora = new Date();
  const entry = {
    id: generarId(),
    tipo: 'no_compra',
    fechaISO: todayISO(),
    hora: ahora.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})
  };
  c.historial.push(entry);
  syncMovimiento(entry, c.id);
  visitasHoy.add(c.id);
  moverAlFinalDelDia(c.id, diaSeleccionado);
  cerrarModal('modalStock');
  renderTodo();
}

// ---------- PAGOS (saldar deuda vieja) ----------
function registrarPago(){
  const c = clientes.find(x=>x.id===clienteSeleccionado);
  const monto = parseFloat(document.getElementById('inputPago').value) || 0;
  if(monto <= 0) return;

  c.saldo -= monto;
  const ahora = new Date();
  const entry = {
    id: generarId(),
    tipo: 'pago',
    fechaISO: todayISO(),
    hora: ahora.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}),
    montoPagado: monto
  };
  c.historial.push(entry);
  syncMovimiento(entry, c.id);
  syncCliente(c);
  syncResumenDiario();

  cobradoHoy += monto;

  document.getElementById('inputPago').value = '';
  renderDetalle(c);
  renderTodo();
}

// ---------- EFECTOS DE MOVIMIENTOS (aplicar / revertir) ----------
// ---------- TRANSFERENCIAS PENDIENTES ----------
function marcarTransferenciaRecibida(clienteId, entryId){
  const c = clientes.find(x=>x.id===clienteId);
  if(!c) return;
  const entry = c.historial.find(h=>h.id===entryId);
  if(!entry || entry.transferenciaConfirmada) return;

  c.saldo -= entry.costo;
  entry.transferenciaConfirmada = true;
  entry.montoPagado = entry.costo;

  cobradoHoy += entry.costo;
  transferenciaHoy += entry.costo;

  syncActualizarMovimiento(entry, c.id);
  syncCliente(c);
  syncResumenDiario();
  guardarEstado();
  renderTransferenciasPendientes();
  renderTodo();
}

function listaTransferenciasPendientes(){
  const pendientes = [];
  clientes.forEach(c=>{
    c.historial.forEach(h=>{
      if(h.formaPago === 'transferencia_pendiente' && !h.transferenciaConfirmada){
        pendientes.push({cliente: c, entry: h});
      }
    });
  });
  pendientes.sort((a,b)=> (a.entry.fechaISO+a.entry.hora).localeCompare(b.entry.fechaISO+b.entry.hora));
  return pendientes;
}

function mostrarTransferenciasPendientes(){
  cerrarMenus();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-transferenciasPendientes').classList.add('active');
  renderTransferenciasPendientes();
}

function renderTransferenciasPendientes(){
  const pendientes = listaTransferenciasPendientes();
  const cont = document.getElementById('listaTransferenciasPendientes');
  const hoy = todayISO();

  if(pendientes.length === 0){
    cont.innerHTML = '<div class="empty-msg">No tenés transferencias pendientes 🎉</div>';
  } else {
    cont.innerHTML = pendientes.map(p=>{
      const esDeHoy = p.entry.fechaISO === hoy;
      const tel = (p.cliente.telefono || '').replace(/[^0-9]/g,'');
      const mensaje = `Hola ${p.cliente.nombre}! Te recuerdo que quedó pendiente la transferencia de $${p.entry.costo.toFixed(0)} del bidón del ${isoAFechaLabel(p.entry.fechaISO)}. Cualquier cosa mandame el comprobante. ¡Gracias!`;
      const linkWhatsApp = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}` : null;
      return `
        <div class="card" style="${esDeHoy ? '' : 'border:2px solid var(--rojo-deuda, #c0392b);'}">
          <h3>${p.cliente.codigo} - ${p.cliente.nombre} ${!esDeHoy ? '⚠️' : ''}</h3>
          <div class="row"><span>Monto:</span><strong>$${p.entry.costo.toFixed(0)}</strong></div>
          <div class="row"><span>Fecha del bidón:</span><span>${isoAFechaLabel(p.entry.fechaISO)} ${p.entry.hora||''}</span></div>
          <div class="btn-row" style="margin-top:8px;">
            <button class="btn verde chico" onclick="marcarTransferenciaRecibida('${p.cliente.id}','${p.entry.id}')">✅ Ya la recibí</button>
            ${linkWhatsApp ? `<a class="btn chico outline" style="text-decoration:none; text-align:center;" href="${linkWhatsApp}">📲 Recordar</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
}

function aplicarEfectoMovimiento(c, entry){
  if(entry.tipo === 'compra'){
    c.saldo += entry.costo;
    c.saldo -= entry.montoPagado;
    c.envasesPendientes += entry.bidones - entry.envases;
    if(c.envasesPendientes < 0) c.envasesPendientes = 0;
    if(entry.fechaISO === todayISO()){
      ventaHoy += entry.costo;
      cobradoHoy += entry.montoPagado;
      if(entry.formaPago==='efectivo') efectivoHoy += entry.montoPagado;
      if(entry.formaPago==='transferencia') transferenciaHoy += entry.montoPagado;
      if(entry.formaPago==='entregado') entregadoHoy += entry.montoPagado;
      const faltante = entry.costo - entry.montoPagado;
      if(faltante > 0) deudaGeneradaHoy += faltante;
      envasesEntregadosHoy += entry.bidones;
      envasesRecibidosHoy += entry.envases;
      b20VendidosHoy += (entry.b20 || 0);
      b10VendidosHoy += (entry.b10 || 0);
      dispVendidosHoy += (entry.disp || 0);
    }
  } else if(entry.tipo === 'pago'){
    if(entry.fechaISO === todayISO()) cobradoHoy += entry.montoPagado;
  }
}

function revertirEfectoMovimiento(c, entry){
  if(entry.tipo === 'compra'){
    c.saldo -= entry.costo;
    c.saldo += entry.montoPagado;
    c.envasesPendientes -= entry.bidones - entry.envases;
    if(c.envasesPendientes < 0) c.envasesPendientes = 0;
    if(entry.fechaISO === todayISO()){
      ventaHoy -= entry.costo;
      cobradoHoy -= entry.montoPagado;
      if(entry.formaPago==='efectivo') efectivoHoy -= entry.montoPagado;
      if(entry.formaPago==='transferencia') transferenciaHoy -= entry.montoPagado;
      if(entry.formaPago==='entregado') entregadoHoy -= entry.montoPagado;
      const faltante = entry.costo - entry.montoPagado;
      if(faltante > 0) deudaGeneradaHoy -= faltante;
      envasesEntregadosHoy -= entry.bidones;
      envasesRecibidosHoy -= entry.envases;
      b20VendidosHoy -= (entry.b20 || 0);
      b10VendidosHoy -= (entry.b10 || 0);
      dispVendidosHoy -= (entry.disp || 0);
    }
  } else if(entry.tipo === 'pago'){
    if(entry.fechaISO === todayISO()) cobradoHoy -= entry.montoPagado;
  }
}

// ---------- BOLETA / COMPROBANTE ----------
function abrirBoleta(clienteId, entryId){
  const c = clientes.find(x=>x.id===clienteId);
  const entry = c.historial.find(h=>h.id===entryId);
  if(!c || !entry || entry.tipo !== 'compra') return;

  const lineas = [];
  lineas.push('🧾 LA NORIA - Comprobante');
  lineas.push('Fecha: ' + isoAFechaLabel(entry.fechaISO) + ' ' + (entry.hora||''));
  lineas.push('Cliente: ' + c.nombre);
  if(c.direccion) lineas.push('Dirección: ' + c.direccion);
  lineas.push('');
  if(entry.b20) lineas.push(`Bidón 20 Lts: ${entry.b20} x $${c.precio} = $${(entry.b20*c.precio).toFixed(0)}`);
  if(entry.b10) lineas.push(`Bidón 10-12 Lts: ${entry.b10} x $${(c.precio10||0)} = $${(entry.b10*(c.precio10||0)).toFixed(0)}`);
  if(entry.disp) lineas.push(`Dispenser: ${entry.disp} x $${(c.precioDisp||0)} = $${(entry.disp*(c.precioDisp||0)).toFixed(0)}`);
  if(entry.envases) lineas.push(`Envases vacíos devueltos: ${entry.envases}`);
  lineas.push('');
  lineas.push('TOTAL: $' + entry.costo.toFixed(0));
  const formaPagoTexto = entry.formaPago==='efectivo' ? 'Efectivo'
    : entry.formaPago==='transferencia' ? 'Transferencia'
    : entry.formaPago==='transferencia_pendiente' ? 'Transferencia (pendiente de confirmar)'
    : 'Entregado parcial / fiado';
  lineas.push('Forma de pago: ' + formaPagoTexto);
  if(entry.montoPagado < entry.costo){
    lineas.push('Saldo pendiente de esta compra: $' + (entry.costo - entry.montoPagado).toFixed(0));
  }
  lineas.push('');
  lineas.push('¡Gracias por su compra! - LA NORIA');

  const texto = lineas.join('\n');
  document.getElementById('boletaTexto').value = texto;

  const tel = (c.telefono || '').replace(/[^0-9]/g,'');
  const btn = document.getElementById('btnBoletaWhatsApp');
  if(tel){
    btn.href = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }

  abrirModal('modalBoleta');
}

function copiarBoleta(){
  const textarea = document.getElementById('boletaTexto');
  textarea.select();
  try{
    navigator.clipboard.writeText(textarea.value).then(()=>{
      alert('Copiado ✅ Ya podés pegarlo donde quieras (otro WhatsApp, notas, etc).');
    }).catch(()=>{
      document.execCommand('copy');
      alert('Copiado ✅');
    });
  }catch(e){
    document.execCommand('copy');
    alert('Copiado ✅');
  }
}

function formatearMovimiento(entry){
  if(!entry) return '';
  if(entry.texto) return entry.texto; // movimiento viejo, guardado antes de esta versión
  if(entry.tipo === 'no_compra') return 'No compró';
  if(entry.tipo === 'pago') return `Pagó $${entry.montoPagado}`;
  const etiquetaPago = entry.formaPago === 'efectivo' ? 'Efectivo · Pagado'
    : entry.formaPago === 'transferencia' ? 'Transferencia · Pagado'
    : entry.formaPago === 'transferencia_pendiente' ? (entry.transferenciaConfirmada ? 'Transferencia · Pagado (confirmada)' : '🕒 Transferencia pendiente')
    : (entry.montoPagado > 0 ? `Entregó $${entry.montoPagado}` : 'Fiado');

  const items = [];
  if(entry.b20) items.push(`${entry.b20} de 20L`);
  if(entry.b10) items.push(`${entry.b10} de 10L`);
  if(entry.disp) items.push(`${entry.disp} dispenser`);
  const detalleItems = items.length > 0 ? items.join(' + ') : `${entry.bidones||0} bidón(es)`;

  return `Compró ${detalleItems} ($${entry.costo}) · ${etiquetaPago}${entry.envases>0 ? ' · devolvió '+entry.envases+' envase(s)' : ''}`;
}

// ---------- EDITAR UN MOVIMIENTO DEL HISTORIAL ----------
let movimientoEditando = null;

function abrirEditarMovimiento(clienteId, entryId){
  const c = clientes.find(x=>x.id===clienteId);
  const entry = c.historial.find(h=>h.id===entryId);
  if(!entry || entry.tipo === 'pago'){ alert('Los pagos no se pueden editar todavía, solo eliminar y volver a cargar.'); return; }
  movimientoEditando = { clienteId, entryId };

  document.getElementById('fechaEditMov').textContent = 'Fecha: ' + isoAFechaLabel(entry.fechaISO);
  setTipoEdicion(entry.tipo);
  if(entry.tipo === 'compra'){
    document.getElementById('editB20').value = entry.b20 || 0;
    document.getElementById('editB10').value = entry.b10 || 0;
    document.getElementById('editDisp').value = entry.disp || 0;
    document.getElementById('editEnvases').value = entry.envases;
    document.getElementById('editFormaPago').value = entry.formaPago;
    document.getElementById('editMontoEntregado').value = entry.montoPagado;
    toggleEditMontoEntregado();
  }
  abrirModal('modalEditarMov');
}

function setTipoEdicion(tipo){
  const esCompra = tipo === 'compra';
  document.getElementById('camposEditCompra').style.display = esCompra ? 'block' : 'none';
  document.getElementById('btnEditCompro').className = 'btn' + (esCompra ? '' : ' outline');
  document.getElementById('btnEditNoCompro').className = 'btn' + (esCompra ? ' outline' : '');
  document.getElementById('camposEditCompra').dataset.tipo = tipo;
}

function toggleEditMontoEntregado(){
  const forma = document.getElementById('editFormaPago').value;
  document.getElementById('editMontoEntregadoWrap').style.display = forma === 'entregado' ? 'block' : 'none';
}

function guardarEdicionMovimiento(){
  if(!movimientoEditando) return;
  const c = clientes.find(x=>x.id===movimientoEditando.clienteId);
  const entry = c.historial.find(h=>h.id===movimientoEditando.entryId);
  const viejo = entry.tipo === 'compra' ? {b20: entry.b20||0, b10: entry.b10||0, disp: entry.disp||0} : {b20:0,b10:0,disp:0};

  revertirEfectoMovimiento(c, entry);

  const nuevoTipo = document.getElementById('camposEditCompra').dataset.tipo;
  entry.tipo = nuevoTipo;
  let nuevo = {b20:0, b10:0, disp:0};
  if(nuevoTipo === 'compra'){
    const b20 = parseInt(document.getElementById('editB20').value) || 0;
    const b10 = parseInt(document.getElementById('editB10').value) || 0;
    const disp = parseInt(document.getElementById('editDisp').value) || 0;
    const envases = parseInt(document.getElementById('editEnvases').value) || 0;
    const formaPago = document.getElementById('editFormaPago').value;
    const costo = b20*c.precio + b10*(c.precio10||0) + disp*(c.precioDisp||0);
    let montoPagado = 0;
    if(formaPago === 'efectivo' || formaPago === 'transferencia'){
      montoPagado = costo;
    } else if(formaPago === 'transferencia_pendiente'){
      montoPagado = 0;
    } else {
      montoPagado = parseFloat(document.getElementById('editMontoEntregado').value) || 0;
    }
    entry.b20 = b20; entry.b10 = b10; entry.disp = disp;
    entry.bidones = b20 + b10 + disp;
    entry.envases = envases;
    entry.costo = costo;
    entry.formaPago = formaPago;
    entry.montoPagado = montoPagado;
    entry.transferenciaConfirmada = (formaPago === 'transferencia_pendiente') ? false : undefined;
    nuevo = {b20, b10, disp};
  }

  // Corregimos el stock del camión por la diferencia (solo si el movimiento es de hoy)
  if(entry.fechaISO === todayISO()){
    stockCamion.b20 = Math.max(0, stockCamion.b20 + viejo.b20 - nuevo.b20);
    stockCamion.b10 = Math.max(0, stockCamion.b10 + viejo.b10 - nuevo.b10);
    stockCamion.disp = Math.max(0, stockCamion.disp + viejo.disp - nuevo.disp);
  }

  aplicarEfectoMovimiento(c, entry);
  syncActualizarMovimiento(entry, c.id);
  syncCliente(c);
  syncStock();

  movimientoEditando = null;
  cerrarModal('modalEditarMov');
  renderDetalle(c);
  renderTodo();
}

// ---------- ANULAR VENTA (deshacer del todo) ----------
function confirmarAnularMovimiento(){
  if(!movimientoEditando) return;
  abrirModal('modalConfirmarAnular');
}

function anularMovimiento(){
  if(!movimientoEditando) return;
  const c = clientes.find(x=>x.id===movimientoEditando.clienteId);
  const entry = c.historial.find(h=>h.id===movimientoEditando.entryId);
  if(!c || !entry) return;

  // Revertimos todo lo que ese movimiento haya sumado (venta, cobrado, deuda, envases)
  revertirEfectoMovimiento(c, entry);

  // Si era una venta de hoy, le devolvemos los bidones al stock del camión
  if(entry.tipo === 'compra' && entry.fechaISO === todayISO()){
    stockCamion.b20 += (entry.b20 || 0);
    stockCamion.b10 += (entry.b10 || 0);
    stockCamion.disp += (entry.disp || 0);
  }

  c.historial = c.historial.filter(h=>h.id !== entry.id);
  syncBorrarMovimiento(entry.id);
  syncCliente(c);
  syncStock();

  movimientoEditando = null;
  cerrarModal('modalConfirmarAnular');
  cerrarModal('modalEditarMov');
  renderDetalle(c);
  renderTodo();
}

// ---------- VISITAS POR FECHA ----------
function cambiarSubtabHistorial(sub){
  const esFecha = sub === 'fecha';
  document.getElementById('histPorFecha').style.display = esFecha ? 'block' : 'none';
  document.getElementById('histPorCliente').style.display = esFecha ? 'none' : 'block';
  document.getElementById('btnHistPorFecha').className = 'btn' + (esFecha ? '' : ' outline');
  document.getElementById('btnHistPorCliente').className = 'btn' + (esFecha ? ' outline' : '');
  if(!esFecha) renderHistorialPorCliente();
}

function renderHistorialPorCliente(){
  const termino = (document.getElementById('inputBuscarClienteHist').value || '').trim().toLowerCase();
  const cont = document.getElementById('listaHistorialPorCliente');
  if(!termino){
    cont.innerHTML = '<div class="empty-msg">Escribí el nombre de un cliente para ver sus compras</div>';
    return;
  }
  const encontrados = clientes.filter(c=>c.nombre.toLowerCase().includes(termino));
  if(encontrados.length === 0){
    cont.innerHTML = '<div class="empty-msg">No se encontró ningún cliente</div>';
    return;
  }
  cont.innerHTML = encontrados.map(c=>{
    const movimientos = c.historial.slice().reverse().map(h=>
      `<div class="mov-item"><span>${formatearMovimiento(h)}</span><span>${isoAFechaLabel(h.fechaISO)} ${h.hora||''}</span></div>`
    ).join('') || '<div class="empty-msg">Sin movimientos todavía</div>';
    const fueraDeRuta = !c.dias.includes(diaSeleccionado);
    const yaAgregado = clientesFueraRutaHoy.has(c.id);
    const botonAgregar = (fueraDeRuta && !yaAgregado)
      ? `<button class="btn chico naranja" style="margin-top:8px;" onclick="agregarAFueraDeReparto('${c.id}')">🚚➕ Agregar a fuera de reparto de hoy</button>`
      : (fueraDeRuta && yaAgregado ? `<div style="color:var(--verde-pago); font-weight:bold; margin-top:8px;">✅ Ya está en fuera de reparto de hoy</div>` : '');
    return `<div class="card"><h3>${c.codigo} - ${c.nombre}</h3><div class="movimientos">${movimientos}</div>${botonAgregar}</div>`;
  }).join('');
}

function mostrarHistorialFecha(){
  cerrarMenus();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-historialFecha').classList.add('active');
  document.getElementById('inputFechaHistorial').value = todayISO();
  cambiarSubtabHistorial('fecha');
  renderHistorialFecha();
}

function renderHistorialFecha(){
  const fecha = document.getElementById('inputFechaHistorial').value;
  const cont = document.getElementById('listaHistorialFecha');
  if(!fecha){ cont.innerHTML = ''; return; }

  let resultados = [];
  clientes.forEach(c=>{
    c.historial.filter(h=>h.fechaISO===fecha).forEach(h=>{
      resultados.push({ cliente: c, entry: h });
    });
  });

  if(resultados.length === 0){
    cont.innerHTML = '<div class="empty-msg">No hay movimientos registrados ese día</div>';
    return;
  }
  cont.innerHTML = resultados.map(r=>`
    <div class="card">
      <h3>${r.cliente.codigo} - ${r.cliente.nombre}</h3>
      <div class="row"><span>${formatearMovimiento(r.entry)}</span></div>
      <button class="btn chico outline" onclick="abrirEditarMovimiento('${r.cliente.id}','${r.entry.id}')">✏️ Corregir</button>
    </div>
  `).join('');
}

// ---------- STOCK DEL CAMION ----------
function mostrarStockCamion(){
  cerrarMenus();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-stockCamion').classList.add('active');
  renderStockCamion();
}

function renderStockCamion(){
  document.getElementById('stockB20').textContent = stockCamion.b20;
  document.getElementById('stockB10').textContent = stockCamion.b10;
  document.getElementById('stockDisp').textContent = stockCamion.disp;
  document.getElementById('stockEnvasesVaciosHoy').textContent = envasesRecibidosHoy;
}

function sumarStock(tipo){
  const inputId = tipo==='b20' ? 'inputSumarB20' : tipo==='b10' ? 'inputSumarB10' : 'inputSumarDisp';
  const cantidad = parseInt(document.getElementById(inputId).value) || 0;
  if(cantidad === 0) return;
  stockCamion[tipo] = Math.max(0, (stockCamion[tipo]||0) + cantidad);
  document.getElementById(inputId).value = '';
  renderStockCamion();
  guardarEstado();
  syncStock();
}

function cargarStockInicial(){
  const b20 = parseInt(document.getElementById('inputStockB20').value);
  const b10 = parseInt(document.getElementById('inputStockB10').value);
  const disp = parseInt(document.getElementById('inputStockDisp').value);
  if(!isNaN(b20)) stockCamion.b20 = b20;
  if(!isNaN(b10)) stockCamion.b10 = b10;
  if(!isNaN(disp)) stockCamion.disp = disp;
  document.getElementById('inputStockB20').value = '';
  document.getElementById('inputStockB10').value = '';
  document.getElementById('inputStockDisp').value = '';
  renderStockCamion();
  guardarEstado();
  syncStock();
}

function ajustarStockManual(tipo, delta){
  stockCamion[tipo] = Math.max(0, (stockCamion[tipo]||0) + delta);
  renderStockCamion();
  guardarEstado();
  syncStock();
}

// ---------- RESPALDO DE DATOS ----------
// ---------- EXPORTAR A EXCEL (CSV, se abre directo en Excel/Sheets) ----------
function exportarExcel(){
  cerrarMenus();
  const filas = [];
  filas.push(['Fecha','Hora','Cliente','Codigo','Direccion','Tipo movimiento','Bidones 20L','Bidones 10-12L','Dispenser','Envases devueltos','Costo','Forma de pago','Monto pagado','Saldo actual del cliente']);

  clientes.forEach(c=>{
    c.historial.forEach(h=>{
      if(h.texto || !h.tipo) return; // saltar movimientos viejos sin estructura
      const tipoLabel = h.tipo === 'compra' ? 'Venta' : h.tipo === 'no_compra' ? 'No compró' : 'Pago';
      const formaPagoLabel = h.formaPago === 'efectivo' ? 'Efectivo'
        : h.formaPago === 'transferencia' ? 'Transferencia'
        : h.formaPago === 'transferencia_pendiente' ? (h.transferenciaConfirmada ? 'Transferencia (confirmada)' : 'Transferencia (pendiente)')
        : h.formaPago === 'entregado' ? 'Entregado parcial / fiado'
        : '';
      filas.push([
        h.fechaISO || '',
        h.hora || '',
        c.nombre,
        c.codigo,
        c.direccion || '',
        tipoLabel,
        h.b20 || 0,
        h.b10 || 0,
        h.disp || 0,
        h.envases || 0,
        h.costo !== undefined ? h.costo.toFixed(0) : '',
        formaPagoLabel,
        h.montoPagado !== undefined ? h.montoPagado.toFixed(0) : '',
        c.saldo.toFixed(0)
      ]);
    });
  });

  const csv = filas.map(fila => fila.map(val=>{
    const str = String(val).replace(/"/g,'""');
    return /[";\n]/.test(str) ? `"${str}"` : str;
  }).join(';')).join('\n');

  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aguatero_movimientos_${diaDeHoy().toLowerCase()}_${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportarRespaldo(){
  cerrarMenus();
  const estado = construirEstadoActual();
  const blob = new Blob([JSON.stringify(estado, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = todayISO();
  const nombreDia = diaDeHoy().toLowerCase();
  a.href = url;
  a.download = `aguatero_respaldo_${nombreDia}_${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Envía el respaldo por Drive, Gmail, WhatsApp, etc. usando el selector nativo del celular
function compartirRespaldo(){
  cerrarMenus();
  const estado = construirEstadoActual();
  const contenido = JSON.stringify(estado, null, 2);
  const fecha = todayISO();
  const nombreArchivo = `aguatero_respaldo_${diaDeHoy().toLowerCase()}_${fecha}.json`;

  try{
    const archivo = new File([contenido], nombreArchivo, {type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[archivo]})){
      navigator.share({
        files: [archivo],
        title: 'Respaldo LA NORIA',
        text: 'Respaldo de datos de LA NORIA - ' + isoAFechaLabel(fecha)
      }).catch(()=>{ /* el usuario cerró el selector, no pasa nada */ });
      return;
    }
  }catch(e){ /* seguimos al fallback */ }

  alert('Tu celular no permite compartir el archivo directamente desde acá.\n\nSe va a descargar a la carpeta Descargas — desde ahí lo podés subir a Drive o mandarlo por Gmail a mano.');
  exportarRespaldo();
}

function restaurarRespaldo(event){
  const archivo = event.target.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = function(e){
    try{
      const estado = JSON.parse(e.target.result);
      aplicarEstadoDesdeObjeto(estado);
      guardarEstado();
      renderTodo();
      alert('Respaldo restaurado con éxito');
    }catch(err){
      alert('No se pudo leer ese archivo de respaldo');
    }
  };
  lector.readAsText(archivo);
  event.target.value = '';
}

// ---------- DESHACER ELIMINACION ----------
// Clientes agregados a "fuera de reparto" durante este reparto (no están programados para hoy)
let clientesFueraRutaHoy = new Set();

function tarjetaCliente(c, i, mostrarBotonesStock){
  const visitado = visitasHoy.has(c.id);
  const fueraDeRuta = !c.dias.includes(diaSeleccionado);
  const yaAgregado = clientesFueraRutaHoy.has(c.id);
  const claseDeuda = c.saldo > 0 ? 'tiene-deuda' : 'al-dia';
  return `
    <div class="card ${claseDeuda}">
      <div onclick="abrirDetalle('${c.id}')">
        <h3>${i!=null ? (i+1)+'. ' : ''}${c.codigo} - ${c.nombre} ${visitado ? '<span class="visitado-tag">Visitado</span>' : ''}</h3>
        <div class="row"><span>${c.direccion || 'Sin dirección'}</span></div>
        <div class="row"><span>Deuda:</span><span class="${c.saldo>0?'deuda':'saldo-ok'}">$${c.saldo.toFixed(0)}</span></div>
        <div class="row"><span>Envases que debe:</span><span>${c.envasesPendientes}</span></div>
      </div>
      ${mostrarBotonesStock ? `
      <div class="btn-row">
        <button class="btn chico" onclick="abrirStock('${c.id}')">📦 Stock</button>
        <button class="btn chico outline" onclick="clienteStockId='${c.id}'; marcarNoCompra()">No compra</button>
      </div>` : ''}
      ${(fueraDeRuta && !yaAgregado) ? `
      <button class="btn chico naranja" style="margin-top:6px;" onclick="agregarAFueraDeReparto('${c.id}')">🚚➕ Agregar a fuera de reparto de hoy</button>` : ''}
    </div>
  `;
}

// ---------- RENDER POR VISITAR (los que faltan del reparto de hoy) ----------
function renderPorVisitar(){
  document.getElementById('tituloDiaHoy').textContent = 'Ruta · ' + diaSeleccionado + (diaSeleccionado===diaDeHoy() ? ' (hoy)' : '');
  const cont = document.getElementById('listaPorVisitar');
  const filtrados = clientes
    .filter(c=>c.dias.includes(diaSeleccionado) && !visitasHoy.has(c.id) && pasaFiltro(c))
    .sort((a,b)=> (a.ordenPorDia[diaSeleccionado]||0) - (b.ordenPorDia[diaSeleccionado]||0));

  if(filtrados.length===0){
    cont.innerHTML = '<div class="empty-msg">Ya atendiste a todos los clientes de este día 🎉</div>';
    return;
  }
  cont.innerHTML = filtrados.map((c,i)=>tarjetaCliente(c,i,true)).join('');
}

// ---------- RENDER ATENDIDOS (los que ya visitaste del reparto de hoy) ----------
function renderAtendidos(){
  const cont = document.getElementById('listaAtendidos');
  const filtrados = clientes
    .filter(c=>visitasHoy.has(c.id) && pasaFiltro(c))
    .sort((a,b)=> (a.ordenPorDia[diaSeleccionado]||0) - (b.ordenPorDia[diaSeleccionado]||0));

  if(filtrados.length===0){
    cont.innerHTML = '<div class="empty-msg">Todavía no atendiste a nadie hoy</div>';
    return;
  }
  cont.innerHTML = filtrados.map((c,i)=>tarjetaCliente(c,i,true)).join('');
}

// ---------- RENDER FUERA DE REPARTO (clientes no programados hoy) ----------
function renderFueraDeReparto(){
  const cont = document.getElementById('listaFueraReparto');
  const termino = (document.getElementById('inputBuscadorFuera').value || '').trim().toLowerCase();
  
  // Primero, mostrar los que ya agregaste (pero todavía sin atender)
  const agregados = clientes.filter(c=>clientesFueraRutaHoy.has(c.id) && !visitasHoy.has(c.id));
  
  // Luego, filtrar disponibles según búsqueda
  let disponibles = clientes.filter(c=>!c.dias.includes(diaSeleccionado) && !clientesFueraRutaHoy.has(c.id) && !visitasHoy.has(c.id));
  if(termino){
    disponibles = disponibles.filter(c=>
      c.nombre.toLowerCase().includes(termino) ||
      c.codigo.toString().includes(termino) ||
      (c.direccion||'').toLowerCase().includes(termino)
    );
  }

  let html = '';
  
  if(agregados.length > 0){
    html += '<div style="margin-bottom:20px;"><div class="card" style="background:var(--verde-pago); color:white;"><strong>✅ Agregados a fuera de reparto hoy (' + diaSeleccionado + ')</strong></div>' + 
      agregados.map(c=>tarjetaCliente(c,null,true)).join('') + '</div>';
  }

  if(termino === '' && disponibles.length === 0 && agregados.length === 0){
    html = '<div class="empty-msg">Escribí el nombre, código o dirección de un cliente para buscarlo y agregarlo</div>';
  } else if(disponibles.length === 0 && termino){
    html += '<div class="empty-msg">No encontramos clientes con eso</div>';
  } else if(disponibles.length > 0){
    if(termino) html += '<div class="card" style="background:var(--celeste); color:white;"><strong>Resultados encontrados</strong></div>';
    html += disponibles.map(c=>`
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div onclick="abrirDetalle('${c.id}')" style="flex:1; cursor:pointer;">
            <h3 style="margin:0 0 6px;">${c.codigo} - ${c.nombre}</h3>
            <div style="font-size:0.9em;">${c.direccion || ''}</div>
            <div style="font-size:0.8em; color:#666; margin-top:4px;">Saldo: <strong>$${c.saldo.toFixed(0)}</strong></div>
          </div>
          <button class="btn chico naranja" onclick="agregarAFueraDeReparto('${c.id}')">➕ Agregar</button>
        </div>
      </div>
    `).join('');
  }

  cont.innerHTML = html;
}

function agregarAFueraDeReparto(clienteId){
  clientesFueraRutaHoy.add(clienteId);
  document.getElementById('inputBuscadorFuera').value = '';
  renderFueraDeReparto();
  renderTodo();
}

// ---------- ESTADISTICAS ----------
function renderEstadisticas(){
  const totalDia = clientes.filter(c=>c.dias.includes(diaSeleccionado)).length;
  document.getElementById('estVenta').textContent = '$' + ventaHoy.toFixed(0);
  document.getElementById('estEfectivo').textContent = '$' + efectivoHoy.toFixed(0);
  document.getElementById('estTransferencia').textContent = '$' + transferenciaHoy.toFixed(0);
  document.getElementById('estDeuda').textContent = '$' + deudaGeneradaHoy.toFixed(0);
  document.getElementById('estVisitados').textContent = visitasHoy.size + '/' + totalDia;
  document.getElementById('estEntregados').textContent = envasesEntregadosHoy;
  document.getElementById('estRecibidos').textContent = envasesRecibidosHoy;
  document.getElementById('estClientesTotal').textContent = clientes.length;
  document.getElementById('estB20').textContent = b20VendidosHoy;
  document.getElementById('estB10').textContent = b10VendidosHoy;
  document.getElementById('estDisp').textContent = dispVendidosHoy;

  const cerrado = resumenesDiarios[todayISO()];
  if(cerrado){
    document.getElementById('estadoCierreHoy').innerHTML =
      `Reparto de hoy cerrado (última vez a las ${cerrado.hora || '-'}). Si seguís vendiendo, podés volver a cerrarlo para actualizar el total.<br><br>` +
      `<strong>Bidones llenos que sobraron:</strong> ${cerrado.b20Sobrante||0} de 20L, ${cerrado.b10Sobrante||0} de 10-12L, ${cerrado.dispSobrante||0} dispensers.`;
  } else {
    document.getElementById('estadoCierreHoy').textContent = 'Todavía no cerraste el reparto de hoy.';
  }
}

// ---------- CERRAR REPARTO DEL DIA ----------
function cerrarRepartoDelDia(){
  const fecha = todayISO();
  resumenesDiarios[fecha] = {
    fecha,
    venta: ventaHoy,
    efectivo: efectivoHoy,
    transferencia: transferenciaHoy,
    deuda: deudaGeneradaHoy,
    envasesEntregados: envasesEntregadosHoy,
    envasesRecibidos: envasesRecibidosHoy,
    b20Vendidos: b20VendidosHoy,
    b10Vendidos: b10VendidosHoy,
    dispVendidos: dispVendidosHoy,
    b20Sobrante: stockCamion.b20,
    b10Sobrante: stockCamion.b10,
    dispSobrante: stockCamion.disp,
    visitas: visitasHoy.size,
    hora: new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})
  };
  guardarEstado();

  // Baja automáticamente un archivo de respaldo con todo lo del día (clientes, historial, etc.)
  exportarRespaldo();

  // Limpiamos el resumen para dejar la app lista para el próximo día
  ventaHoy = 0; cobradoHoy = 0; efectivoHoy = 0; transferenciaHoy = 0;
  entregadoHoy = 0; deudaGeneradaHoy = 0; envasesEntregadosHoy = 0; envasesRecibidosHoy = 0;
  b20VendidosHoy = 0; b10VendidosHoy = 0; dispVendidosHoy = 0;
  visitasHoy = new Set();
  clientesFueraRutaHoy = new Set();

  // El stock del camión se vacía: lo que sobró queda anotado arriba en el resumen del día
  stockCamion = { b20: 0, b10: 0, disp: 0 };

  guardarEstado();
  renderEstadisticas();
  renderTodo();
  alert('Reparto del día cerrado ✅\n\nSe guardó en el reporte semanal y se descargó un respaldo del día.\nEl resumen y el stock del camión ya quedaron en cero, listos para el próximo reparto.');
}

// ---------- REPORTE SEMANAL ----------
function mostrarReporteSemanal(){
  cerrarMenus();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-reporteSemanal').classList.add('active');
  renderReporteSemanal();
}

function renderReporteSemanal(){
  const dias = [];
  for(let i=6; i>=0; i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    dias.push(iso);
  }

  let totVenta=0, totEfectivo=0, totTransferencia=0, totDeuda=0, totEntregados=0, totRecibidos=0;
  let totB20=0, totB10=0, totDisp=0;
  const cont = document.getElementById('listaReporteSemanal');
  cont.innerHTML = dias.map(iso=>{
    const r = resumenesDiarios[iso];
    const nombreDia = DIAS[(new Date(iso+'T00:00:00').getDay()+6)%7];
    if(!r){
      return `<div class="card"><h3>${nombreDia} ${isoAFechaLabel(iso)}</h3><div class="empty-msg" style="padding:10px;">Sin cerrar</div></div>`;
    }
    totVenta+=r.venta; totEfectivo+=r.efectivo; totTransferencia+=r.transferencia;
    totDeuda+=r.deuda; totEntregados+=r.envasesEntregados; totRecibidos+=r.envasesRecibidos;
    totB20+=(r.b20Vendidos||0); totB10+=(r.b10Vendidos||0); totDisp+=(r.dispVendidos||0);
    return `<div class="card">
      <h3>${nombreDia} ${isoAFechaLabel(iso)}</h3>
      <div class="row"><span>Venta:</span><strong>$${r.venta.toFixed(0)}</strong></div>
      <div class="row"><span>Efectivo:</span><span>$${r.efectivo.toFixed(0)}</span></div>
      <div class="row"><span>Transferencia:</span><span>$${r.transferencia.toFixed(0)}</span></div>
      <div class="row"><span>Fiado:</span><span class="deuda">$${r.deuda.toFixed(0)}</span></div>
      <div class="row"><span>Vendidos 20L / 10-12L / Disp:</span><span>${r.b20Vendidos||0} / ${r.b10Vendidos||0} / ${r.dispVendidos||0}</span></div>
      <div class="row"><span>Sobraron 20L / 10-12L / Disp:</span><span>${r.b20Sobrante||0} / ${r.b10Sobrante||0} / ${r.dispSobrante||0}</span></div>
      <div class="row"><span>Visitas:</span><span>${r.visitas}</span></div>
    </div>`;
  }).join('');

  document.getElementById('semVenta').textContent = '$' + totVenta.toFixed(0);
  document.getElementById('semEfectivo').textContent = '$' + totEfectivo.toFixed(0);
  document.getElementById('semTransferencia').textContent = '$' + totTransferencia.toFixed(0);
  document.getElementById('semDeuda').textContent = '$' + totDeuda.toFixed(0);
  document.getElementById('semEntregados').textContent = totEntregados;
  document.getElementById('semRecibidos').textContent = totRecibidos;
  document.getElementById('semB20').textContent = totB20;
  document.getElementById('semB10').textContent = totB10;
  document.getElementById('semDisp').textContent = totDisp;
}

// ---------- FOOTER DE ESTADISTICAS RAPIDAS ----------
function renderFooter(){
  const totalDia = clientes.filter(c=>c.dias.includes(diaSeleccionado)).length;
  document.getElementById('statVendido').textContent = '$' + ventaHoy.toFixed(0);
  document.getElementById('statCobrado').textContent = '$' + cobradoHoy.toFixed(0);
  document.getElementById('statVisitas').textContent = visitasHoy.size + '/' + totalDia;
}

function renderTodo(){
  verificarResetDiario();
  renderPorVisitar();
  renderAtendidos();
  renderFueraDeReparto();
  renderFooter();
  renderSelectDespuesDe();
  renderSelectorDiaVista();
  actualizarFechaHoyLabel();
  actualizarBannerTransferencias();
  if(document.getElementById('view-estadisticas').classList.contains('active')) renderEstadisticas();
  if(document.getElementById('view-stockCamion').classList.contains('active')) renderStockCamion();
  guardarEstado();
}

function actualizarBannerTransferencias(){
  const pendientes = listaTransferenciasPendientes();

  const badge = document.getElementById('badgeTransferencias');
  if(pendientes.length > 0){
    badge.textContent = pendientes.length;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// ---------- PWA: Service Worker + botón de instalar ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js').catch(function(e){
      console.log('No se pudo registrar el Service Worker:', e);
    });
  });
}

let eventoInstalacionDiferido = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  eventoInstalacionDiferido = e;
  const boton = document.getElementById('btnInstalarApp');
  if(boton) boton.style.display = 'block';
});

document.getElementById('btnInstalarApp').addEventListener('click', function(){
  const boton = document.getElementById('btnInstalarApp');
  boton.style.display = 'none';
  if(!eventoInstalacionDiferido) return;
  eventoInstalacionDiferido.prompt();
  eventoInstalacionDiferido.userChoice.then(function(){
    eventoInstalacionDiferido = null;
  });
});

window.addEventListener('appinstalled', function(){
  const boton = document.getElementById('btnInstalarApp');
  if(boton) boton.style.display = 'none';
});

// ---------- INICIALIZACION (recién después de iniciar sesión) ----------
function inicializarAppLuegoDeLogin(){
  cargarEstado();
  renderFiltroTabs();
  renderTodo();

  // Guardado extra de seguridad: por si el celular cierra la app de golpe
  // (al mandar WhatsApp, al apretar Atrás, al minimizar, etc.)
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') guardarEstado();
  });
  window.addEventListener('pagehide', guardarEstado);
  window.addEventListener('beforeunload', guardarEstado);
  setInterval(guardarEstado, 10000); // respaldo silencioso cada 10 segundos
}