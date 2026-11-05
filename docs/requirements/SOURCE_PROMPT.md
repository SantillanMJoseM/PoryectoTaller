Actúa como ingeniero full-stack senior. Debes recrear exactamente el sistema web "Sistema Taller", una aplicación de gestión para talleres y servicios técnicos, sin agregar ni quitar funcionalidades. No improvises módulos nuevos. Mantén la lógica de negocio, los flujos, las validaciones, los permisos y la estructura de datos descritos a continuación.

STACK TECNOLÓGICO A USAR EN LOVABLE
- Frontend: React + TypeScript + Tailwind CSS + shadcn/ui.
- Backend y base de datos: Supabase (PostgreSQL, Auth, Storage, Row Level Security).
- Generación de PDF: usar una librería compatible (jsPDF o react-pdf) manteniendo el mismo contenido y formato de los reportes.
- Idioma de la interfaz: español.
- Diseño: responsive, tipo panel administrativo clásico, con barra lateral/superior, tablas, formularios, modales y paginación.

OBJETIVO
Recrear fielmente "Sistema Taller", incluyendo todos los módulos, entidades, relaciones, reportes, permisos, portal de cliente y auditoría. No reducir funcionalidades. No cambiar nombres de negocio. No inventar procesos adicionales.

MÓDULOS OBLIGATORIOS
1. Autenticación administrativa.
2. Panel principal.
3. Clientes.
4. Productos.
5. Servicios.
6. Órdenes de trabajo.
7. Ventas.
8. Garantías.
9. Financiero.
10. Archivos/Documentos.
11. Usuarios.
12. Permisos.
13. Informes/Reportes.
14. Auditoría.
15. Cola de emails.
16. Portal del cliente.
17. Configuración de empresa.

AUTENTICACIÓN Y SESIONES
- Login administrativo por correo electrónico y contraseña.
- Contraseñas almacenadas con hash seguro (bcrypt/argon2).
- Sesión persistente con expiración.
- Cerrar sesión.
- Control de acceso por permisos.
- Portal de cliente separado: ingreso por correo electrónico + documento del cliente. Si coinciden con un cliente registrado, crear sesión de cliente.

MODELO DE DATOS (PostgreSQL, nombres en español)

clientes:
- id_cliente (PK)
- nombre_cliente
- sexo
- persona_fisica (booleano)
- documento
- telefono
- celular
- correo
- fecha_registro
- calle, numero, barrio, ciudad, estado, codigo_postal

productos:
- id_producto (PK)
- descripcion
- unidad
- precio_compra
- precio_venta
- stock
- stock_minimo
- salida (booleano)
- entrada (booleano)

servicios:
- id_servicio (PK)
- nombre
- descripcion
- precio

ordenes_trabajo:
- id_orden (PK)
- fecha_inicial
- fecha_final
- garantia
- descripcion_producto
- defecto
- estado (Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas)
- observaciones
- laudo_tecnico
- valor_total
- cliente_id (FK clientes)
- usuario_id (FK usuarios)
- lanzamiento_id (FK movimientos_financieros, nullable)
- facturado (booleano)
- garantia_id (FK garantias, nullable)

productos_orden:
- id_producto_orden (PK)
- cantidad
- descripcion
- precio
- orden_id (FK ordenes_trabajo)
- producto_id (FK productos)
- subtotal

servicios_orden:
- id_servicio_orden (PK)
- servicio
- cantidad
- precio
- orden_id (FK ordenes_trabajo)
- servicio_id (FK servicios)
- subtotal

ventas:
- id_venta (PK)
- fecha_venta
- valor_total
- descuento
- facturado (booleano)
- cliente_id (FK clientes)
- usuario_id (FK usuarios)
- lanzamiento_id (FK movimientos_financieros, nullable)

items_venta:
- id_item_venta (PK)
- cantidad
- descripcion
- precio
- venta_id (FK ventas)
- producto_id (FK productos)
- subtotal

garantias:
- id_garantia (PK)
- fecha_garantia
- referencia
- texto_garantia
- usuario_id (FK usuarios)

movimientos_financieros:
- id_movimiento (PK)
- descripcion
- valor
- fecha_vencimiento
- fecha_pago
- pagado (booleano)
- cliente_proveedor
- forma_pago
- tipo (ingreso/egreso)
- anexo
- cliente_id (FK clientes, nullable)
- categoria_id (FK categorias, nullable)
- cuenta_id (FK cuentas, nullable)
- venta_id (FK ventas, nullable)

categorias:
- id_categoria (PK)
- categoria
- fecha_registro
- estado (booleano)
- tipo (ingreso/egreso)

cuentas:
- id_cuenta (PK)
- cuenta
- banco
- numero
- saldo
- fecha_registro
- estado (booleano)
- tipo

anexos:
- id_anexo (PK)
- anexo
- miniatura
- url
- ruta
- orden_id (FK ordenes_trabajo)

documentos:
- id_documento (PK)
- documento
- descripcion
- archivo
- ruta
- url
- fecha_registro
- categoria
- tipo
- tamaño

marcas:
- id_marca (PK)
- marca
- fecha_registro
- estado (booleano)

equipos:
- id_equipo (PK)
- equipo
- numero_serie
- modelo
- color
- descripcion
- tension
- potencia
- voltaje
- fecha_fabricacion
- marca_id (FK marcas)
- cliente_id (FK clientes)

equipos_orden:
- id_equipo_orden (PK)
- defecto_declarado
- defecto_encontrado
- solucion
- equipo_id (FK equipos)
- orden_id (FK ordenes_trabajo)

usuarios:
- id_usuario (PK)
- nombre
- rg
- cpf
- calle, numero, barrio, ciudad, estado
- correo
- contraseña
- telefono
- celular
- estado (booleano)
- fecha_registro
- permiso_id (FK permisos)
- fecha_expiracion

permisos:
- id_permiso (PK)
- nombre
- permisos (texto con códigos de actividad separados por coma o JSON)
- estado (booleano)
- fecha

empresa:
- id (PK)
- nombre
- cnpj
- ie
- calle, numero, barrio, ciudad, provincia
- telefono
- correo
- url_logo

logs_auditoria:
- id_log (PK)
- usuario
- tarea
- fecha
- hora
- ip

cola_emails:
- id (PK)
- para
- cc
- cco
- mensaje
- estado (pendiente, enviando, enviado, fallido)
- fecha
- encabezados

sesiones:
- tabla de sesiones de base de datos.

FUNCIONALIDADES POR MÓDULO

1. Panel principal
- Mostrar resumen operativo: órdenes abiertas, productos con stock bajo, últimas ventas, movimientos pendientes.
- Accesos rápidos a módulos.
- Mostrar usuario conectado y menú según permisos.

2. Clientes
- Crear, editar, eliminar y visualizar clientes.
- Búsqueda por nombre/documento/correo.
- Paginación.
- Vinculación con órdenes, ventas, financiero y garantías.

3. Productos
- Crear, editar, eliminar y visualizar productos.
- Campos de compra/venta, unidad, stock y stock mínimo.
- Alerta de stock bajo.
- Descontar stock al agregar producto a una orden o venta.
- Incrementar stock al eliminar producto de una orden o venta.

4. Servicios
- Crear, editar, eliminar y visualizar servicios.
- Nombre, descripción y precio.

5. Órdenes de trabajo
- Crear, editar, eliminar y visualizar órdenes.
- Estados: Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas.
- Fechas inicial y final.
- Cliente, usuario/técnico, garantía.
- Descripción del producto, defecto, observaciones, laudo técnico.
- Agregar/quitar productos con cantidad, precio y subtotal.
- Agregar/quitar servicios con cantidad, precio y subtotal.
- Cálculo de valor total.
- Adjuntar archivos con miniatura, URL y ruta.
- Enviar orden por correo al cliente.
- Imprimir orden.
- Facturar orden: crear movimiento financiero y marcar como facturada.
- Autocompletado de clientes, productos, servicios, usuarios y términos de garantía.
- Control de stock al agregar/eliminar productos.

6. Ventas
- Crear, editar, eliminar y visualizar ventas.
- Cliente, usuario, fecha.
- Agregar/quitar productos con cantidad, precio y subtotal.
- Descuento y valor total.
- Facturar venta: crear movimiento financiero y marcar como facturada.
- Imprimir venta.
- Control de stock.

7. Garantías
- Crear, editar, eliminar y visualizar términos de garantía.
- Referencia, texto y fecha.
- Asociación a órdenes.
- Impresión.

8. Financiero
- Crear, editar, eliminar movimientos.
- Tipo: ingreso o egreso.
- Valor, fecha de vencimiento, fecha de pago, estado pagado/pendiente.
- Cliente/proveedor, categoría, cuenta, forma de pago.
- Anexo.
- Vinculación con venta.
- Filtros por período: día, semana, mes, año, todos.
- Filtros por situación: todos, previsto, atrasado, realizado, pendiente.
- Totales por período.
- Detección de vencidos.

9. Archivos/Documentos
- Crear, editar, eliminar documentos.
- Carga de archivos.
- Metadatos: nombre, descripción, categoría, tipo, tamaño, fecha.
- Descarga.
- Organización por categoría.

10. Usuarios
- Crear, editar, eliminar y visualizar usuarios.
- Nombre, RG, CPF, dirección, teléfono, celular, correo.
- Contraseña con hash.
- Estado activo/inactivo.
- Fecha de registro.
- Fecha de expiración.
- Asignación de grupo de permisos.

11. Permisos
- Crear, editar, desactivar grupos de permisos.
- Nombre, estado, fecha.
- Permisos almacenados como códigos de actividad.
- Códigos de actividad:
  a = agregar, e = editar, d = eliminar, v = visualizar, r = reporte, c = configuración.
- Módulos cubiertos: Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa.
- Ejemplos: aCliente, eCliente, dCliente, vCliente, rCliente; aProducto, etc.

12. Informes/Reportes
- Reportes de clientes.
- Reportes de productos (incluye stock bajo).
- Reportes de servicios.
- Reportes de órdenes (filtros por estado, fecha, cliente).
- Reportes de ventas.
- Reportes financieros.
- Versiones rápidas (todos los registros) y personalizadas (con filtros).
- Filtros por fecha inicial/final, precio inicial/final, stock inicial/final.
- Generación de PDF con encabezado de empresa, datos tabulados y paginación.
- Descarga/visualización en línea del PDF.

13. Auditoría
- Registrar acciones del usuario: usuario, tarea, fecha, hora, IP.
- Listar logs.
- Limpiar logs.

14. Cola de emails
- Crear emails con destinatario, cc, cco, mensaje, encabezados.
- Estados: pendiente, enviando, enviado, fallido.
- Procesar cola.
- Reintentar envíos fallidos.
- Eliminar emails.

15. Portal del cliente
- Ingreso por correo + documento.
- Panel con últimas compras y órdenes.
- Ver detalle de orden y compra.
- Imprimir orden/compra.
- Ver y editar datos de cuenta.
- Cerrar sesión.

16. Configuración de empresa
- Crear, editar datos de la empresa.
- Nombre, CNPJ, IE, dirección, teléfono, correo.
- Logo para reportes PDF.

REGLAS DE NEGOCIO IMPORTANTES
- No eliminar datos de producción durante pruebas.
- El stock se actualiza automáticamente al agregar/eliminar productos en órdenes o ventas.
- Una orden puede facturarse una sola vez; al facturar se crea un movimiento financiero y se marca facturado=true.
- Una venta puede facturarse una sola vez; al facturar se crea un movimiento financiero y se marca facturado=true.
- Los reportes PDF deben usar los datos de la empresa.
- Los permisos controlan acceso a cada módulo y acción.
- Las fechas deben mostrarse en formato dd/mm/aaaa.
- Los valores monetarios deben mostrarse con 2 decimales.
- La auditoría debe registrar acciones relevantes.

SEGURIDAD
- Usar Row Level Security en Supabase.
- Separar roles administrador/cliente.
- Validar formularios en frontend y backend.
- Sanitizar entradas.
- Proteger rutas privadas.
- No exponer credenciales en el frontend.

ENTREGABLE ESPERADO
- Aplicación completa y funcional.
- Base de datos con todas las tablas y relaciones.
- Datos de ejemplo mínimos para pruebas.
- Todos los módulos navegables.
- Reportes PDF funcionales.
- Portal de cliente funcional.
- Sistema de permisos funcional.
- Auditoría funcional.

No omitas ningún módulo, tabla, relación, filtro, reporte ni flujo descrito. Si algún detalle no está especificado, infiere la implementación más simple y consistente con el sistema descrito, sin agregar funcionalidades nuevas.