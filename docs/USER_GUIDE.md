# Guía de Usuario — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0016 — Documentación |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Destinatarios | Operadores del taller, clientes del portal, administradores |

Convenciones de esta guía:

- **Fechas** en formato `dd/mm/aaaa`; **importes monetarios** con 2 decimales (RB-005/RB-008).
- Las tablas usan búsqueda, filtros y **paginación**; los formularios abren en **modal** y validan los campos en español.
- Para acceder a un módulo, el grupo de permisos del usuario debe incluir al menos uno de los **códigos de actividad** indicados. Si no, la pantalla muestra “Acceso restringido”.

## 1. Iniciar sesión (panel administrativo)

1. Abra la aplicación y vaya a `/login`.
2. Ingrese su **correo electrónico** y **contraseña** (se almacenan con hash seguro en Supabase Auth).
3. La sesión queda persistente y se cierra con expiración o con **Cerrar sesión** (menú del usuario).

El menú lateral muestra únicamente los módulos habilitados por sus permisos.

> **Primer uso:** si nadie puede entrar, un administrador debe primero crear la credencial en Supabase Auth y la ficha en **Usuarios** (ver README §Primer usuario administrador).

## 2. Panel principal

Al entrar ve el resumen operativo:

- **Órdenes abiertas** por estado (Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas).
- **Productos con stock bajo** (stock ≤ stock mínimo) con su alerta.
- **Últimas ventas** y **movimientos financieros pendientes**.
- **Accesos rápidos** a los módulos según sus permisos.
- El **usuario conectado** en la cabecera.

## 3. Clientes

- Alta/edición/eliminación/visualización de clientes: nombre, sexo, persona física, documento, teléfono, celular, correo y dirección (calle, número, barrio, ciudad, estado, código postal).
- Búsqueda por **nombre, documento o correo**; paginación.
- El detalle muestra la **vinculación** del cliente con órdenes, ventas, movimientos financieros y garantías.
- El **correo + documento** son las credenciales del portal del cliente: ingrese datos correctos para habilitar el acceso del cliente.

## 4. Productos

- Alta/edición/eliminación de productos: descripción, unidad, precio de compra, precio de venta, stock, stock mínimo y marcas de **salida/entrada**.
- **Alerta de stock bajo**: el panel y el listado marcan los productos con stock ≤ stock mínimo.
- El stock se gestiona **automáticamente**: al agregar un producto a una orden o venta se descuenta; al quitarlo o cambiar cantidad se devuelve/ajusta. No edite el stock a mano (la base lo impide con un guard).

## 5. Servicios

- Alta/edición/eliminación de servicios con **nombre, descripción y precio**. Los servicios forman parte de las órdenes de trabajo y **no afectan el stock**.

## 6. Órdenes de trabajo

Flujo típico: crear la orden → agregar productos/servicios → seguimiento de estado → facturar/imprimir/enviar.

- **Nueva orden:** elija cliente, usuario/técnico, garantía (opcional), fechas inicial y final, estado, descripción del producto, defecto, observaciones y laudo técnico. Estados disponibles: **Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas**. Los campos se autocompletan con clientes, productos, servicios, usuarios y términos de garantía existentes.
- **Líneas de productos:** agregar/quitar con cantidad, precio y subtotal; cada cambio ajusta el stock. Líneas de **servicios:** igual, sin tocar stock.
- **Valor total:** suma de subtotales, recalculado automáticamente.
- **Equipos intervenidos:** se pueden registrar equipos del cliente (marca, serie, modelo, defecto declarado/encontrado, solución).
- **Adjuntos:** cada orden admite archivos con miniatura, URL y ruta (bucket privado `anexos-orden`).
- **Enlaces:** cambiar estado, asociar/consultar garantía.
- **Enviar por correo:** desencola un email al cliente desde la **Cola de emails**.
- **Imprimir:** genera el PDF de la orden con datos de la empresa.
- **Facturar:** crea un movimiento financiero (ingreso) y marca `facturado = true`. **Una orden solo se factura una vez**; el botón se deshabilita y la base también lo bloquea.

## 7. Ventas

- Nueva venta: cliente, usuario, fecha; agregar/quitar productos con cantidad, precio y subtotal; **descuento** y valor total (`Σ subtotales − descuento`, nunca menor que cero).
- **Control de stock** igual que en órdenes.
- **Facturar:** crea el movimiento financiero y marca `facturado = true` (única vez).
- **Imprimir:** PDF de la venta.

## 8. Garantías

- Alta/edición/eliminación de términos de garantía: **referencia, texto y fecha**.
- **Asociar a órdenes:** al crear o editar una orden puede elegir la garantía; la orden guarda su referencia.
- **Impresión** del texto de garantía.

## 9. Financiero

- Alta/edición/eliminación de movimientos: **tipo (ingreso/egreso)**, valor, fecha de vencimiento, fecha de pago, pagado, cliente/proveedor, categoría, cuenta, forma de pago, anexo y vinculación con venta/orden facturadas.
- Regla: si marca **pagado**, la fecha de pago es obligatoria; el botón “Marcar pagado” la completa.
- **Filtros:** por **período** (día, semana, mes, año, todos), por **situación** (todos, previsto, atrasado, realizado, pendiente), por tipo, cliente, categoría, cuenta y búsqueda de texto.
- **Totales por período:** ingresos, egresos y saldo; contador de **vencidos** y pendientes.
- La situación se calcula: pagado → *realizado*; vencido sin pagar → *atrasado*; vence a futuro → *previsto*; vence hoy sin pagar → *pendiente*.
- Los egresos admiten **comprobante** adjunto.

## 10. Archivos/Documentos

- Alta/edición/eliminación de documentos con **carga de archivos** (máx. 20 MB por archivo) y metadatos: nombre, descripción, categoría, tipo, tamaño, fecha.
- **Descarga** por URL firmada (1 hora) y organización por **categoría**.

## 11. Usuarios

- Alta/edición/eliminación/visualización de usuarios: nombre, RG, CPF, dirección, teléfonos, correo, teléfono/celular, **estado activo/inactivo**, fecha de registro y **fecha de expiración**.
- La **contraseña no se guarda en la ficha**: se gestiona como credencial de Supabase Auth (hash bcrypt). Desde el formulario se puede crear la credencial del usuario.
- **Grupo de permisos:** asignar uno de los grupos creados en el módulo Permisos.

## 12. Permisos

- Crear, editar y **desactivar** grupos de permisos: nombre, estado y fecha.
- Los permisos se almacenan como **códigos de actividad**: `a` = agregar, `e` = editar, `d` = eliminar, `v` = visualizar, `r` = reporte, `c` = configuración.
- Módulos cubiertos: **Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa** (p. ej. `aCliente`, `eCliente`, `dCliente`, `vCliente`, `rCliente`; `aProducto`, …).
- Para el detalle de qué códigos usa cada pantalla, ver la tabla de módulos del `README.md`.

## 13. Informes/Reportes

Tipos de reporte: **Clientes, Productos (con stock bajo), Servicios, Órdenes, Ventas y Financiero**.

- **Versión rápida:** todos los registros, sin filtros.
- **Versión personalizada:** filtros por fecha inicial/final, precio inicial/final y stock inicial/final (según el reporte); órdenes además por estado y cliente.
- **PDF:** generado con el **encabezado de la empresa** (nombre, dirección, contacto), datos en tabla, paginación y pie con fecha de generación. Permite **descarga** y **visualización en línea**.

## 14. Auditoría

- Registra las acciones relevantes: **usuario, tarea, fecha, hora e IP**.
- Listado paginado de logs recientes.
- **Limpiar logs** (borra el histórico; requiere el permiso correspondiente).

## 15. Cola de emails

- Cada email se compone de **destinatario (para), CC, CCO, mensaje y encabezados**; los estados son **pendiente, enviando, enviado, fallido**.
- **Procesar cola:** intenta el envío de los pendientes a través de la función de envío; **Reintentar** toma los fallidos con retardo exponencial. Un correo atascado en *enviando* más de 10 minutos se recupera automáticamente.
- **Autoproceso:** cada 60 s el navegador procesa la cola (desactívela con `VITE_EMAILS_AUTO_PROCESAR=false` en `.env.local`).
- **Eliminar** emails de la cola.

> **Sin Edge Function de envío desplegada**, el envío real no puede concretarse y los correos quedan como *fallido* tras el intento (o permanecen *pendiente* si aún no se procesó la cola). Pulse **Reintentar** una vez desplegada.

## 16. Portal del cliente

Acceso público en `/portal`:

1. Ingrese **correo electrónico + documento**. Si coinciden con un cliente registrado, se crea la sesión de cliente (24 h).
2. El panel muestra las **últimas compras y órdenes** del cliente.
3. **Ver e imprimir** el detalle de cada orden o compra (PDF).
4. **Ver y editar los datos de su cuenta** (nombre, dirección, teléfonos…). **Correo y documento son inmutables** desde el portal; para cambiarlos, contacte al taller.
5. **Cerrar sesión**.

> Sin la Edge Function `portal-login` desplegada, el portal mantiene la sesión solo localmente para navegar su panel; los datos protegidos por RLS para clientes no estarán disponibles (limitación documentada en `docs/TECHNICAL_GUIDE.md`).

## 17. Configuración de empresa

- Crear/editar el registro único de la empresa: nombre, CNPJ, IE, dirección (calle, número, barrio, ciudad, provincia), teléfono y correo.
- **Logo** para los reportes PDF (bucket `logos`, archivo público de hasta 5 MB).

## Preguntas frecuentes

| Situación | Qué hacer |
|---|---|
| “Acceso restringido” en un módulo | Pedir al administrador que agregue los códigos de actividad a su grupo de permisos. |
| No puedo cambiar el stock de un producto | Es intencional: el stock se ajusta solo con órdenes/ventas. |
| Duplicar la facturación de una orden/venta | Bloqueado: solo se factura una vez. |
| Correo no llegó | Verificar su estado en Cola de emails y reintentar. |
| Cliente no entra al portal | Verificar que **correo y documento** coincidan exactamente con la ficha del cliente. |
| Fechas raras en reportes | Se muestran en `dd/mm/aaaa`; verifique que la fecha ISO sea válida al cargar. |
