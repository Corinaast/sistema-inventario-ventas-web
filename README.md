# Proyecto A: Sistema de inventario y ventas

## Propósito
Frontend completo para la evaluación final de Fundamentos Web. El estudiante debe implementar la lógica en `js/app.js`.

## Archivos de datos
- `data/productos.json`: 30 registros.
- `data/categorias.json`: 8 registros.
- `data/pedidos.json`: 30 registros y entidad principal del CRUD.

## Ejecución
El proyecto utiliza `fetch` para leer JSON locales. Debe ejecutarse mediante un servidor local:

```bash
python -m http.server 8000
```

Luego abra `http://localhost:8000` o use la extensión Live Server de Visual Studio Code.

## Regla de edición
Se permite modificar únicamente `js/app.js`. Los archivos HTML, CSS y JSON forman parte de la base entregada.

## API externa
- DummyJSON Products: https://dummyjson.com/docs/products
- Flujo: Buscar productos externos por texto y consultar el detalle del producto seleccionado por ID.

## Bibliotecas ya cargadas
Bootstrap 5.3.8, SweetAlert2, Toastify y Chart.js.
