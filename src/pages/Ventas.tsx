import SimpleCrud from "../components/SimpleCrud";
export default function Ventas() {
  return <SimpleCrud title="Ventas" table="ventas" pk="id_venta"
    columns={[{key:"fecha_venta",label:"Fecha"},{key:"valor_total",label:"Total"},{key:"facturado",label:"Facturado"}]}
    fields={[{key:"descuento",label:"Descuento",type:"number"},{key:"facturado",label:"Facturado"}]} />;
}
