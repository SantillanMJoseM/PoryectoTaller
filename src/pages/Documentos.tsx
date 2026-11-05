import SimpleCrud from "../components/SimpleCrud";
export default function Documentos() {
  return <SimpleCrud title="Documentos" table="documentos" pk="id_documento"
    columns={[{key:"documento",label:"Documento"},{key:"categoria",label:"Categoría"},{key:"tipo",label:"Tipo"}]}
    fields={[{key:"documento",label:"Documento"},{key:"descripcion",label:"Descripción"},{key:"categoria",label:"Categoría"},{key:"tipo",label:"Tipo"}]} />;
}
