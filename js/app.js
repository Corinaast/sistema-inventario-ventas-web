"use strict";

/*
  EVALUACIÓN FINAL DE JAVASCRIPT
  Archivo autorizado para edición: js/app.js

  La interfaz, los estilos y los archivos JSON ya fueron entregados.
  Complete la lógica sin escribir registros manualmente en el HTML.
*/

const CONFIG = Object.freeze({
  storageKey: "examen_inventario_productos",
  primaryUrl: "./data/productos.json",
  relatedUrl: "./data/categorias.json",
  transactionsUrl: "./data/pedidos.json",
  externalSearchUrl: "https://dummyjson.com/products/search?q=",
  externalDetailUrl: "https://dummyjson.com/products/"
});

const STOCK_BAJO = 10;

let registros = [];
let catalogoPrincipal = [];
let catalogoRelacionado = [];
let idEnEdicion = null;
let graficoResumen = null;
let datosExternos = [];

const dom = {
  formulario: document.getElementById("formRegistro"),
  formularioTitulo: document.getElementById("formularioTitulo"),
  botonGuardar: document.getElementById("btnGuardar"),
  botonCancelarEdicion: document.getElementById("btnCancelarEdicion"),
  botonRestaurar: document.getElementById("btnRestaurar"),
  buscador: document.getElementById("inputBusqueda"),
  filtroPrincipal: document.getElementById("filtroPrincipal"),
  filtroSecundario: document.getElementById("filtroSecundario"),
  ordenamiento: document.getElementById("ordenamiento"),
  botonLimpiarFiltros: document.getElementById("btnLimpiarFiltros"),
  contenedorRegistros: document.getElementById("contenedorRegistros"),
  cuerpoTabla: document.getElementById("cuerpoTabla"),
  estadoVacio: document.getElementById("estadoVacio"),
  modalJson: document.getElementById("modalJson"),
  salidaJson: document.getElementById("salidaJson"),
  botonJsonGeneral: document.getElementById("btnJsonGeneral"),
  inputApi: document.getElementById("inputApi"),
  botonApi: document.getElementById("btnConsultarApi"),
  resultadosApi: document.getElementById("resultadosApi"),
  modalApi: document.getElementById("modalApi"),
  contenidoModalApi: document.getElementById("contenidoModalApi"),
  grafico: document.getElementById("graficoResumen"),
  tablaEstadisticas: document.getElementById("tablaEstadisticas"),
  loader: document.getElementById("loader"),
  stat1: document.getElementById("stat1"),
  stat2: document.getElementById("stat2"),
  stat3: document.getElementById("stat3"),
  stat4: document.getElementById("stat4")
};

document.addEventListener("DOMContentLoaded", iniciarAplicacion);
async function iniciarAplicacion() {
  registrarEventos();

  mostrarLoader(true);
  try {
    const almacenados = recuperarDesdeLocalStorage();

    if (almacenados) {
      registros = almacenados;
      catalogoRelacionado = await cargarJsonLocal(CONFIG.relatedUrl);
      catalogoPrincipal = await cargarJsonLocal(CONFIG.transactionsUrl);
      mostrarToast("Datos recuperados desde localStorage", "info");
    } else {
      await cargarDatosIniciales();
      guardarEnLocalStorage();
      mostrarToast("Datos cargados desde los archivos JSON", "exito");
    }

    completarSelectores();
    renderizarRegistros(aplicarBusquedaFiltrosYOrden());
    actualizarIndicadores();
    actualizarTablaEstadisticas();
    actualizarGrafico();
  } catch (error) {
    mostrarError("No se pudieron cargar los datos iniciales: " + error.message);
  } finally {
    mostrarLoader(false);
  }
}

function registrarEventos() {
  dom.formulario.addEventListener("submit", manejarFormulario);
  dom.botonCancelarEdicion.addEventListener("click", cancelarEdicion);
  dom.botonRestaurar.addEventListener("click", restaurarDatosOriginales);

  dom.buscador.addEventListener("input", function () {
    renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  });

  dom.filtroPrincipal.addEventListener("change", function () {
    renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  });

  dom.filtroSecundario.addEventListener("change", function () {
    renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  });

  dom.ordenamiento.addEventListener("change", function () {
    renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  });

  dom.botonLimpiarFiltros.addEventListener("click", limpiarFiltros);

  dom.botonJsonGeneral.addEventListener("click", function () {
    mostrarJson(registros);
  });

  dom.botonApi.addEventListener("click", consultarApiExterna);
  dom.inputApi.addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      consultarApiExterna();
    }
  });

  dom.contenedorRegistros.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;

    const id = Number(boton.dataset.id);
    const accion = boton.dataset.accion;

    if (accion === "editar") prepararEdicion(id);
    if (accion === "eliminar") eliminarRegistro(id);
    if (accion === "json") {
      const registro = registros.find(function (item) {
        return item.id === id;
      });
      mostrarJson(registro);
    }
  });

  dom.resultadosApi.addEventListener("click", function (evento) {
    const boton = evento.target.closest("button[data-accion]");
    if (!boton) return;

    const id = Number(boton.dataset.id);

    if (boton.dataset.accion === "detalle") consultarDetalleExterno(id);
    if (boton.dataset.accion === "importar") {
      const externo = datosExternos.find(function (item) {
        return item.id === id;
      });
      transformarYAgregarExterno(externo);
    }
  });
}

async function cargarJsonLocal(ruta) {
  try {
    const response = await fetch(ruta);

    if (!response.ok) {
      throw new Error("Error HTTP " + response.status + " al leer " + ruta);
    }

    return await response.json();
  } catch (error) {
    throw new Error("Fallo la lectura de " + ruta + ". " + error.message);
  }
}

async function cargarDatosIniciales() {
  const [productos, categorias, pedidos] = await Promise.all([
    cargarJsonLocal(CONFIG.primaryUrl),
    cargarJsonLocal(CONFIG.relatedUrl),
    cargarJsonLocal(CONFIG.transactionsUrl)
  ]);

  registros = productos;
  catalogoRelacionado = categorias;
  catalogoPrincipal = pedidos;
}

function recuperarDesdeLocalStorage() {
  try {
    const texto = localStorage.getItem(CONFIG.storageKey);
    if (!texto) return null;

    const datos = JSON.parse(texto);
    return Array.isArray(datos) && datos.length > 0 ? datos : null;
  } catch (error) {
    console.warn("localStorage corrupto, se usará el JSON original.", error);
    return null;
  }
}

function guardarEnLocalStorage() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(registros));
}

async function restaurarDatosOriginales() {
  const confirmacion = await Swal.fire({
    title: "¿Restaurar los datos originales?",
    text: "Se perderán todos los cambios guardados en este navegador.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, restaurar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc3545"
  });

  if (!confirmacion.isConfirmed) return;

  mostrarLoader(true);
  try {
    localStorage.removeItem(CONFIG.storageKey);
    await cargarDatosIniciales();
    guardarEnLocalStorage();

    cancelarEdicion();
    limpiarFiltros();
    completarSelectores();
    actualizarIndicadores();
    actualizarTablaEstadisticas();
    actualizarGrafico();

    mostrarToast("Datos originales restaurados", "exito");
  } catch (error) {
    mostrarError("No se pudo restaurar: " + error.message);
  } finally {
    mostrarLoader(false);
  }
}

function completarSelectores() {
  const selectFormulario = document.getElementById("categoriaId");

  dom.filtroPrincipal.length = 1;
  selectFormulario.length = 1;

  catalogoRelacionado.forEach(function (categoria) {
    const opcionFiltro = document.createElement("option");
    opcionFiltro.value = categoria.id;
    opcionFiltro.textContent = categoria.nombre;
    dom.filtroPrincipal.appendChild(opcionFiltro);

    const opcionFormulario = document.createElement("option");
    opcionFormulario.value = categoria.id;
    opcionFormulario.textContent = categoria.nombre;
    selectFormulario.appendChild(opcionFormulario);
  });
}

function manejarFormulario(evento) {
  evento.preventDefault();

  const datos = obtenerDatosFormulario();

  if (!validarDatos(datos)) return;

  if (idEnEdicion === null) {
    agregarRegistro(datos);
  } else {
    actualizarRegistro(datos);
  }
}

function obtenerDatosFormulario() {
  return {
    codigo: document.getElementById("codigo").value.trim().toUpperCase(),
    nombre: document.getElementById("nombre").value.trim(),
    categoriaId: Number(document.getElementById("categoriaId").value),
    precio: Number(document.getElementById("precio").value),
    stock: Number(document.getElementById("stock").value),
    marca: document.getElementById("marca").value.trim(),
    activo: document.getElementById("activo").value === "true"
  };
}

function validarDatos(datos) {
  if (!datos.codigo || !datos.nombre || !datos.marca) {
    mostrarError("El código, el nombre y la marca son obligatorios.");
    return false;
  }

  if (!datos.categoriaId) {
    mostrarError("Seleccione una categoría.");
    return false;
  }

  if (!Number.isFinite(datos.precio) || datos.precio <= 0) {
    mostrarError("El precio debe ser un número mayor que cero.");
    return false;
  }

  if (!Number.isInteger(datos.stock) || datos.stock < 0) {
    mostrarError("El stock debe ser un número entero igual o mayor que cero.");
    return false;
  }

  const duplicado = registros.some(function (item) {
    return item.codigo.toUpperCase() === datos.codigo && item.id !== idEnEdicion;
  });

  if (duplicado) {
    mostrarError("Ya existe un producto con el código " + datos.codigo + ".");
    return false;
  }

  return true;
}

function generarNuevoId() {
  const mayor = registros.reduce(function (maximo, item) {
    return item.id > maximo ? item.id : maximo;
  }, 0);

  return mayor + 1;
}

function agregarRegistro(datos) {
  const nuevo = {
    id: generarNuevoId(),
    codigo: datos.codigo,
    nombre: datos.nombre,
    categoriaId: datos.categoriaId,
    precio: datos.precio,
    stock: datos.stock,
    marca: datos.marca,
    imagen: "assets/img/producto-01.svg",
    activo: datos.activo
  };

  registros.push(nuevo);
  guardarEnLocalStorage();

  dom.formulario.reset();
  renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  actualizarIndicadores();
  actualizarTablaEstadisticas();
  actualizarGrafico();

  mostrarToast("Producto \"" + nuevo.nombre + "\" agregado", "exito");
}

function prepararEdicion(id) {
  const registro = registros.find(function (item) {
    return item.id === id;
  });

  if (!registro) {
    mostrarError("El producto solicitado ya no existe.");
    return;
  }

  idEnEdicion = registro.id;

  document.getElementById("codigo").value = registro.codigo;
  document.getElementById("nombre").value = registro.nombre;
  document.getElementById("categoriaId").value = registro.categoriaId;
  document.getElementById("precio").value = registro.precio;
  document.getElementById("stock").value = registro.stock;
  document.getElementById("marca").value = registro.marca;
  document.getElementById("activo").value = String(registro.activo);

  dom.formularioTitulo.textContent = "Editar producto: " + registro.nombre;
  dom.botonGuardar.textContent = "Guardar cambios";
  dom.botonCancelarEdicion.classList.remove("d-none");

  const pestana = document.querySelector('[data-bs-target="#tabFormulario"]');
  bootstrap.Tab.getOrCreateInstance(pestana).show();
  dom.formulario.scrollIntoView({ behavior: "smooth", block: "center" });
}

function actualizarRegistro(datos) {
  const indice = registros.findIndex(function (item) {
    return item.id === idEnEdicion;
  });

  if (indice === -1) {
    mostrarError("No se encontró el registro que intenta editar.");
    return;
  }

  const nombreAnterior = registros[indice].nombre;

  registros[indice] = {
    ...registros[indice],
    codigo: datos.codigo,
    nombre: datos.nombre,
    categoriaId: datos.categoriaId,
    precio: datos.precio,
    stock: datos.stock,
    marca: datos.marca,
    activo: datos.activo
  };

  guardarEnLocalStorage();
  cancelarEdicion();

  renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  actualizarIndicadores();
  actualizarTablaEstadisticas();
  actualizarGrafico();

  mostrarToast("Producto \"" + nombreAnterior + "\" actualizado", "exito");
}

async function eliminarRegistro(id) {
  const registro = registros.find(function (item) {
    return item.id === id;
  });

  if (!registro) return;

  const confirmacion = await Swal.fire({
    title: "¿Eliminar producto?",
    text: "Se eliminará \"" + registro.nombre + "\" del inventario.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc3545"
  });

  if (!confirmacion.isConfirmed) return;

  registros = registros.filter(function (item) {
    return item.id !== id;
  });

  if (idEnEdicion === id) cancelarEdicion();

  guardarEnLocalStorage();
  renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  actualizarIndicadores();
  actualizarTablaEstadisticas();
  actualizarGrafico();

  mostrarToast("Producto eliminado", "exito");
}

function cancelarEdicion() {
  idEnEdicion = null;
  dom.formulario.reset();
  dom.formularioTitulo.textContent = "Registrar producto";
  dom.botonGuardar.textContent = "Agregar registro";
  dom.botonCancelarEdicion.classList.add("d-none");
}

function aplicarBusquedaFiltrosYOrden() {
  const texto = dom.buscador.value.trim().toLowerCase();
  const categoria = dom.filtroPrincipal.value;
  const disponibilidad = dom.filtroSecundario.value;
  const orden = dom.ordenamiento.value;

  let resultado = registros.filter(function (item) {
    const coincideTexto =
      texto === "" ||
      item.nombre.toLowerCase().includes(texto) ||
      item.codigo.toLowerCase().includes(texto) ||
      item.marca.toLowerCase().includes(texto);

    const coincideCategoria =
      categoria === "" || item.categoriaId === Number(categoria);

    let coincideDisponibilidad = true;
    if (disponibilidad === "activo") coincideDisponibilidad = item.activo === true;
    if (disponibilidad === "inactivo") coincideDisponibilidad = item.activo === false;
    if (disponibilidad === "bajo") coincideDisponibilidad = item.stock < STOCK_BAJO;

    return coincideTexto && coincideCategoria && coincideDisponibilidad;
  });

  if (orden === "nombre-asc") {
    resultado.sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre);
    });
  }
  if (orden === "precio-asc") {
    resultado.sort(function (a, b) {
      return a.precio - b.precio;
    });
  }
  if (orden === "precio-desc") {
    resultado.sort(function (a, b) {
      return b.precio - a.precio;
    });
  }
  if (orden === "stock-desc") {
    resultado.sort(function (a, b) {
      return b.stock - a.stock;
    });
  }

  return resultado;
}

function renderizarRegistros(datos) {
  dom.contenedorRegistros.innerHTML = "";

  if (datos.length === 0) {
    dom.estadoVacio.classList.remove("d-none");
    dom.estadoVacio.innerHTML =
      '<h3 class="h5">Sin resultados</h3>' +
      '<p class="mb-0">Ningún producto coincide con la búsqueda o los filtros aplicados.</p>';
    return;
  }

  dom.estadoVacio.classList.add("d-none");

  datos.forEach(function (registro) {
    dom.contenedorRegistros.appendChild(crearElementoRegistro(registro));
  });
}

function crearElementoRegistro(registro) {
  const categoria = catalogoRelacionado.find(function (item) {
    return item.id === registro.categoriaId;
  });

  const columna = document.createElement("div");
  columna.className = "col-12 col-md-6 col-xl-4";

  const tarjeta = document.createElement("div");
  tarjeta.className = "card h-100 shadow-sm";
  tarjeta.dataset.id = registro.id;

  const imagen = document.createElement("img");
  imagen.src = registro.imagen;
  imagen.alt = registro.nombre;
  imagen.className = "card-img-top p-3";
  imagen.style.height = "160px";
  imagen.style.objectFit = "contain";

  const cuerpo = document.createElement("div");
  cuerpo.className = "card-body d-flex flex-column";

  const encabezado = document.createElement("div");
  encabezado.className = "d-flex justify-content-between align-items-start mb-2";

  const titulo = document.createElement("h3");
  titulo.className = "h6 mb-0";
  titulo.textContent = registro.nombre;

  const estado = document.createElement("span");
  estado.className = registro.activo
    ? "badge text-bg-success"
    : "badge text-bg-secondary";
  estado.textContent = registro.activo ? "Disponible" : "No disponible";

  encabezado.appendChild(titulo);
  encabezado.appendChild(estado);

  const codigo = document.createElement("p");
  codigo.className = "small text-secondary mb-1";
  codigo.textContent = registro.codigo + " · " + registro.marca;

  const relacion = document.createElement("p");
  relacion.className = "small mb-2";
  relacion.textContent = "Categoría: " + (categoria ? categoria.nombre : "Sin categoría");

  const precio = document.createElement("p");
  precio.className = "fw-bold fs-5 mb-1";
  precio.textContent = formatearMoneda(registro.precio);

  const stock = document.createElement("p");
  stock.className =
    registro.stock < STOCK_BAJO ? "small text-danger mb-3" : "small text-secondary mb-3";
  stock.textContent =
    "Stock: " + registro.stock + (registro.stock < STOCK_BAJO ? " (bajo)" : "");

  const acciones = document.createElement("div");
  acciones.className = "mt-auto d-flex gap-2";

  const botonJson = document.createElement("button");
  botonJson.className = "btn btn-sm btn-outline-primary";
  botonJson.textContent = "JSON";
  botonJson.dataset.accion = "json";
  botonJson.dataset.id = registro.id;

  const botonEditar = document.createElement("button");
  botonEditar.className = "btn btn-sm btn-outline-secondary";
  botonEditar.textContent = "Editar";
  botonEditar.dataset.accion = "editar";
  botonEditar.dataset.id = registro.id;

  const botonEliminar = document.createElement("button");
  botonEliminar.className = "btn btn-sm btn-outline-danger";
  botonEliminar.textContent = "Eliminar";
  botonEliminar.dataset.accion = "eliminar";
  botonEliminar.dataset.id = registro.id;

  acciones.appendChild(botonJson);
  acciones.appendChild(botonEditar);
  acciones.appendChild(botonEliminar);

  cuerpo.appendChild(encabezado);
  cuerpo.appendChild(codigo);
  cuerpo.appendChild(relacion);
  cuerpo.appendChild(precio);
  cuerpo.appendChild(stock);
  cuerpo.appendChild(acciones);

  tarjeta.appendChild(imagen);
  tarjeta.appendChild(cuerpo);
  columna.appendChild(tarjeta);

  return columna;
}

function mostrarJson(datos) {
  dom.salidaJson.textContent = JSON.stringify(datos, null, 2);
  bootstrap.Modal.getOrCreateInstance(dom.modalJson).show();
}

function calcularEstadisticas() {
  const total = registros.length;

  if (total === 0) {
    return {
      total: 0,
      valorInventario: 0,
      precioPromedio: 0,
      masCaro: null,
      masEconomico: null,
      mayorStock: null,
      porCategoria: [],
      totalVendido: 0,
      stockBajo: 0
    };
  }

  const valorInventario = registros.reduce(function (suma, item) {
    return suma + item.precio * item.stock;
  }, 0);

  const sumaPrecios = registros.reduce(function (suma, item) {
    return suma + item.precio;
  }, 0);
  const precioPromedio = sumaPrecios / total;

  const porPrecio = [...registros].sort(function (a, b) {
    return a.precio - b.precio;
  });
  const masEconomico = porPrecio[0];
  const masCaro = porPrecio[porPrecio.length - 1];

  const mayorStock = [...registros].sort(function (a, b) {
    return b.stock - a.stock;
  })[0];

  const porCategoria = catalogoRelacionado.map(function (categoria) {
    const cantidad = registros.filter(function (item) {
      return item.categoriaId === categoria.id;
    }).length;

    return { nombre: categoria.nombre, cantidad: cantidad };
  });

  const totalVendido = catalogoPrincipal
    .filter(function (pedido) {
      return pedido.estado === "Completado";
    })
    .reduce(function (suma, pedido) {
      return suma + pedido.cantidad;
    }, 0);

  const stockBajo = registros.filter(function (item) {
    return item.stock < STOCK_BAJO;
  }).length;

  return {
    total: total,
    valorInventario: valorInventario,
    precioPromedio: precioPromedio,
    masCaro: masCaro,
    masEconomico: masEconomico,
    mayorStock: mayorStock,
    porCategoria: porCategoria,
    totalVendido: totalVendido,
    stockBajo: stockBajo
  };
}

function actualizarIndicadores() {
  const stats = calcularEstadisticas();

  dom.stat1.textContent = stats.total;
  dom.stat2.textContent = formatearMoneda(stats.valorInventario);
  dom.stat3.textContent = formatearMoneda(stats.precioPromedio);
  dom.stat4.textContent = stats.stockBajo;
}

function actualizarTablaEstadisticas() {
  const stats = calcularEstadisticas();

  const filas = [
    { etiqueta: "1. Total de productos", valor: String(stats.total) },
    { etiqueta: "2. Valor total del inventario", valor: formatearMoneda(stats.valorInventario) },
    { etiqueta: "3. Precio promedio", valor: formatearMoneda(stats.precioPromedio) },
    {
      etiqueta: "4. Producto más caro",
      valor: stats.masCaro ? stats.masCaro.nombre + " (" + formatearMoneda(stats.masCaro.precio) + ")" : "-"
    },
    {
      etiqueta: "5. Producto más económico",
      valor: stats.masEconomico ? stats.masEconomico.nombre + " (" + formatearMoneda(stats.masEconomico.precio) + ")" : "-"
    },
    {
      etiqueta: "6. Producto con mayor stock",
      valor: stats.mayorStock ? stats.mayorStock.nombre + " (" + stats.mayorStock.stock + " u.)" : "-"
    },
    {
      etiqueta: "7. Cantidad por categoría",
      valor: stats.porCategoria
        .map(function (item) {
          return item.nombre + ": " + item.cantidad;
        })
        .join(" · ")
    },
    { etiqueta: "8. Total vendido según pedidos", valor: stats.totalVendido + " unidades" }
  ];

  dom.tablaEstadisticas.innerHTML = "";

  filas.forEach(function (fila) {
    const item = document.createElement("div");
    item.className = "list-group-item d-flex justify-content-between gap-3";

    const etiqueta = document.createElement("span");
    etiqueta.className = "text-secondary small";
    etiqueta.textContent = fila.etiqueta;

    const valor = document.createElement("span");
    valor.className = "fw-semibold text-end";
    valor.textContent = fila.valor;

    item.appendChild(etiqueta);
    item.appendChild(valor);
    dom.tablaEstadisticas.appendChild(item);
  });
}

function actualizarGrafico() {
  const stats = calcularEstadisticas();

  if (graficoResumen) {
    graficoResumen.destroy();
  }

  prepararContenedorGrafico();

  graficoResumen = new Chart(dom.grafico, {
    type: "bar",
    data: {
      labels: stats.porCategoria.map(function (item) {
        return item.nombre;
      }),
      datasets: [
        {
          label: "Productos por categoría",
          data: stats.porCategoria.map(function (item) {
            return item.cantidad;
          }),
          backgroundColor: "#0d6efd",
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      resizeDelay: 100,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}

function prepararContenedorGrafico() {
  const contenedor = dom.grafico.parentElement;

  contenedor.style.position = "relative";
  contenedor.style.height = "340px";
  contenedor.style.maxHeight = "340px";
  contenedor.style.overflow = "hidden";

  dom.grafico.style.display = "block";
  dom.grafico.style.width = "100%";
  dom.grafico.style.height = "100%";
}

async function consultarApiExterna() {
  const termino = dom.inputApi.value.trim();

  if (termino === "") {
    mostrarError("Escriba una palabra para consultar la API externa.");
    return;
  }

  mostrarLoader(true);

  try {
    const url = CONFIG.externalSearchUrl + encodeURIComponent(termino);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("La API respondió con el estado " + response.status);
    }

    const datos = await response.json();
    datosExternos = datos.products;

    renderizarResultadosApi(datosExternos);
    mostrarToast("Se encontraron " + datosExternos.length + " resultados externos", "info");
  } catch (error) {
    dom.resultadosApi.innerHTML =
      '<div class="empty-state"><h3 class="h5">Error de conexión</h3>' +
      '<p class="mb-0">No se pudo consultar la API externa.</p></div>';
    mostrarError("Error al consultar la API: " + error.message);
  } finally {
    mostrarLoader(false);
  }
}

function renderizarResultadosApi(datos) {
  dom.resultadosApi.innerHTML = "";

  if (datos.length === 0) {
    dom.resultadosApi.innerHTML =
      '<div class="empty-state"><h3 class="h5">Sin coincidencias</h3>' +
      '<p class="mb-0">La búsqueda no devolvió resultados en DummyJSON.</p></div>';
    return;
  }

  datos.forEach(function (producto) {
    const columna = document.createElement("div");
    columna.className = "col-12 col-md-6 col-xl-4";

    const tarjeta = document.createElement("div");
    tarjeta.className = "card h-100 shadow-sm";

    const imagen = document.createElement("img");
    imagen.src = producto.thumbnail;
    imagen.alt = producto.title;
    imagen.className = "card-img-top p-3";
    imagen.style.height = "160px";
    imagen.style.objectFit = "contain";

    const cuerpo = document.createElement("div");
    cuerpo.className = "card-body d-flex flex-column";

    const titulo = document.createElement("h3");
    titulo.className = "h6";
    titulo.textContent = producto.title;

    const marca = document.createElement("p");
    marca.className = "small text-secondary mb-1";
    marca.textContent = "Marca: " + (producto.brand || "Sin marca");

    const categoria = document.createElement("p");
    categoria.className = "small text-secondary mb-1";
    categoria.textContent = "Categoría: " + producto.category;

    const precio = document.createElement("p");
    precio.className = "fw-bold mb-1";
    precio.textContent = formatearMoneda(producto.price);

    const stock = document.createElement("p");
    stock.className = "small text-secondary mb-3";
    stock.textContent = "Stock: " + producto.stock;

    const acciones = document.createElement("div");
    acciones.className = "mt-auto d-flex gap-2";

    const botonDetalle = document.createElement("button");
    botonDetalle.className = "btn btn-sm btn-primary";
    botonDetalle.textContent = "Ver detalle";
    botonDetalle.dataset.accion = "detalle";
    botonDetalle.dataset.id = producto.id;

    const botonImportar = document.createElement("button");
    botonImportar.className = "btn btn-sm btn-outline-success";
    botonImportar.textContent = "Importar";
    botonImportar.dataset.accion = "importar";
    botonImportar.dataset.id = producto.id;

    acciones.appendChild(botonDetalle);
    acciones.appendChild(botonImportar);

    cuerpo.appendChild(titulo);
    cuerpo.appendChild(marca);
    cuerpo.appendChild(categoria);
    cuerpo.appendChild(precio);
    cuerpo.appendChild(stock);
    cuerpo.appendChild(acciones);

    tarjeta.appendChild(imagen);
    tarjeta.appendChild(cuerpo);
    columna.appendChild(tarjeta);

    dom.resultadosApi.appendChild(columna);
  });
}

async function consultarDetalleExterno(id) {
  mostrarLoader(true);

  try {
    const response = await fetch(CONFIG.externalDetailUrl + id);

    if (!response.ok) {
      throw new Error("La API respondió con el estado " + response.status);
    }

    const producto = await response.json();

    dom.contenidoModalApi.innerHTML =
      '<div class="text-center mb-3">' +
      '<img src="' + producto.thumbnail + '" alt="" style="max-height:200px">' +
      "</div>" +
      "<h3 class=\"h5\">" + producto.title + "</h3>" +
      "<p>" + producto.description + "</p>" +
      '<ul class="list-group list-group-flush">' +
      '<li class="list-group-item">ID externo: ' + producto.id + "</li>" +
      '<li class="list-group-item">Marca: ' + (producto.brand || "Sin marca") + "</li>" +
      '<li class="list-group-item">Categoría: ' + producto.category + "</li>" +
      '<li class="list-group-item">Precio: ' + formatearMoneda(producto.price) + "</li>" +
      '<li class="list-group-item">Stock: ' + producto.stock + "</li>" +
      '<li class="list-group-item">Calificación: ' + producto.rating + "</li>" +
      "</ul>";

    bootstrap.Modal.getOrCreateInstance(dom.modalApi).show();
  } catch (error) {
    mostrarError("No se pudo obtener el detalle: " + error.message);
  } finally {
    mostrarLoader(false);
  }
}

function transformarYAgregarExterno(item) {
  if (!item) return;

  const codigo = "EXT-" + String(item.id).padStart(3, "0");

  const duplicado = registros.some(function (registro) {
    return registro.codigo.toUpperCase() === codigo;
  });

  if (duplicado) {
    mostrarError("El producto externo " + codigo + " ya fue importado.");
    return;
  }

  const nuevo = {
    id: generarNuevoId(),
    codigo: codigo,
    nombre: item.title,
    categoriaId: catalogoRelacionado.length > 0 ? catalogoRelacionado[0].id : 1,
    precio: Number(item.price),
    stock: Number(item.stock),
    marca: item.brand || "Externo",
    imagen: item.thumbnail,
    activo: true
  };

  registros.push(nuevo);
  guardarEnLocalStorage();

  renderizarRegistros(aplicarBusquedaFiltrosYOrden());
  actualizarIndicadores();
  actualizarTablaEstadisticas();
  actualizarGrafico();

  mostrarToast("Producto externo \"" + nuevo.nombre + "\" importado", "exito");
}

function limpiarFiltros() {
  dom.buscador.value = "";
  dom.filtroPrincipal.value = "";
  dom.filtroSecundario.value = "";
  dom.ordenamiento.value = "";

  renderizarRegistros(aplicarBusquedaFiltrosYOrden());
}

function mostrarLoader(visible) {
  dom.loader.classList.toggle("active", visible);
}

function mostrarToast(mensaje, tipo = "info") {
  const colores = {
    exito: "#198754",
    error: "#dc3545",
    info: "#0d6efd"
  };

  Toastify({
    text: mensaje,
    duration: 3000,
    gravity: "top",
    position: "right",
    close: true,
    style: { background: colores[tipo] || colores.info }
  }).showToast();
}

function mostrarError(mensaje) {
  Swal.fire({
    title: "Atención",
    text: mensaje,
    icon: "error",
    confirmButtonText: "Entendido",
    confirmButtonColor: "#0d6efd"
  });
}

function formatearMoneda(valor) {
  return "$" + Number(valor).toFixed(2);
}
