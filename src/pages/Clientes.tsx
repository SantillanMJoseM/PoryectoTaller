import SimpleCrud from "../components/SimpleCrud";
export default function Clientes() {
  return <SimpleCrud title="Clientes" table="clientes" pk="id_cliente"
    columns={[{key:"nombre_cliente",label:"Nombre"},{key:"documento",label:"Documento"},{key:"correo",label:"Correo"},{key:"telefono",label:"Teléfono"}]}
    fields={[{key:"nombre_cliente",label:"Nombre"},{key:"documento",label:"Documento"},{key:"correo",label:"Correo"},{key:"telefono",label:"Teléfono"},{key:"celular",label:"Celular"}]} />;
}
