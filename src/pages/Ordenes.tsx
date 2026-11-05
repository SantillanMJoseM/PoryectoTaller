import SimpleCrud from "../components/SimpleCrud";
export default function Ordenes() {
  return <SimpleCrud title="Órdenes de Trabajo" table="ordenes_trabajo" pk="id_orden"
    columns={[{key:"estado",label:"Estado"},{key:"valor_total",label:"Total"},{key:"facturado",label:"Facturado"},{key:"fecha_inicial",label:"Fecha inicial"}]}
    fields={[{key:"descripcion_producto",label:"Descripción producto"},{key:"defecto",label:"Defecto"},{key:"estado",label:"Estado"},{key:"observaciones",label:"Observaciones"},{key:"valor_total",label:"Valor total",type:"number"}]} />;
}
