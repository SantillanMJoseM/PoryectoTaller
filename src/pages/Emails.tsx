import SimpleCrud from "../components/SimpleCrud";
export default function Emails() {
  return <SimpleCrud title="Cola de Emails" table="cola_emails" pk="id"
    columns={[{key:"para",label:"Para"},{key:"estado",label:"Estado"},{key:"fecha",label:"Fecha"}]}
    fields={[{key:"para",label:"Para"},{key:"cc",label:"CC"},{key:"cco",label:"CCO"},{key:"mensaje",label:"Mensaje"},{key:"estado",label:"Estado"}]} />;
}
