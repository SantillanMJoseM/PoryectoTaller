import SimpleCrud from "../components/SimpleCrud";
export default function Auditoria() {
  return <SimpleCrud title="Auditoría" table="logs_auditoria" pk="id_log"
    columns={[{key:"usuario",label:"Usuario"},{key:"tarea",label:"Tarea"},{key:"fecha",label:"Fecha"},{key:"hora",label:"Hora"}]}
    fields={[{key:"usuario",label:"Usuario"},{key:"tarea",label:"Tarea"}]} />;
}
