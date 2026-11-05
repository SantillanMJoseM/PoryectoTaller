import SimpleCrud from "../components/SimpleCrud";
export default function Permisos() {
  return <SimpleCrud title="Permisos" table="permisos" pk="id_permiso"
    columns={[{key:"nombre",label:"Nombre"},{key:"estado",label:"Estado"}]}
    fields={[{key:"nombre",label:"Nombre"},{key:"permisos",label:"Códigos"}]} />;
}
