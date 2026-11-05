import SimpleCrud from "../components/SimpleCrud";
export default function Financiero() {
  return <SimpleCrud title="Financiero" table="movimientos_financieros" pk="id_movimiento"
    columns={[{key:"descripcion",label:"Descripción"},{key:"valor",label:"Valor"},{key:"tipo",label:"Tipo"},{key:"pagado",label:"Pagado"}]}
    fields={[{key:"descripcion",label:"Descripción"},{key:"valor",label:"Valor",type:"number"},{key:"tipo",label:"Tipo"},{key:"forma_pago",label:"Forma pago"},{key:"cliente_proveedor",label:"Cliente/Proveedor"}]} />;
}
