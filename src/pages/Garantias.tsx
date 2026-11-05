import SimpleCrud from "../components/SimpleCrud";
export default function Garantias() {
  return <SimpleCrud title="Garantías" table="garantias" pk="id_garantia"
    columns={[{key:"referencia",label:"Referencia"},{key:"fecha_garantia",label:"Fecha"},{key:"texto_garantia",label:"Texto"}]}
    fields={[{key:"referencia",label:"Referencia"},{key:"texto_garantia",label:"Texto"}]} />;
}
