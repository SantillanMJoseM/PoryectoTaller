import SimpleCrud from "../components/SimpleCrud";
export default function Usuarios() {
  return <SimpleCrud title="Usuarios" table="usuarios" pk="id_usuario"
    columns={[{key:"nombre",label:"Nombre"},{key:"correo",label:"Correo"},{key:"estado",label:"Estado"}]}
    fields={[{key:"nombre",label:"Nombre"},{key:"correo",label:"Correo"},{key:"telefono",label:"Teléfono"},{key:"celular",label:"Celular"}]} />;
}
