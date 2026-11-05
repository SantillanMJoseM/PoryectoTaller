import SimpleCrud from "../components/SimpleCrud";
export default function Empresa() {
  return <SimpleCrud title="Empresa" table="empresa" pk="id"
    columns={[{key:"nombre",label:"Nombre"},{key:"correo",label:"Correo"},{key:"telefono",label:"Teléfono"}]}
    fields={[{key:"nombre",label:"Nombre"},{key:"cnpj",label:"CNPJ"},{key:"ie",label:"IE"},{key:"calle",label:"Calle"},{key:"numero",label:"Número"},{key:"barrio",label:"Barrio"},{key:"ciudad",label:"Ciudad"},{key:"provincia",label:"Provincia"},{key:"telefono",label:"Teléfono"},{key:"correo",label:"Correo"},{key:"url_logo",label:"URL Logo"}]} />;
}
