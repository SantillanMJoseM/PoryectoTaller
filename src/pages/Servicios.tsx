import SimpleCrud from "../components/SimpleCrud";
export default function Servicios() {
  return <SimpleCrud title="Servicios" table="servicios" pk="id_servicio"
    columns={[{key:"nombre",label:"Nombre"},{key:"descripcion",label:"Descripción"},{key:"precio",label:"Precio"}]}
    fields={[{key:"nombre",label:"Nombre"},{key:"descripcion",label:"Descripción"},{key:"precio",label:"Precio",type:"number"}]} />;
}
