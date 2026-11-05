import SimpleCrud from "../components/SimpleCrud";
export default function Productos() {
  return <SimpleCrud title="Productos" table="productos" pk="id_producto"
    columns={[{key:"descripcion",label:"Descripción"},{key:"unidad",label:"Unidad"},{key:"precio_venta",label:"Precio venta"},{key:"stock",label:"Stock"}]}
    fields={[{key:"descripcion",label:"Descripción"},{key:"unidad",label:"Unidad"},{key:"precio_compra",label:"Precio compra",type:"number"},{key:"precio_venta",label:"Precio venta",type:"number"},{key:"stock",label:"Stock",type:"number"},{key:"stock_minimo",label:"Stock mínimo",type:"number"}]} />;
}
