import { ProductoFicha } from "@/components/inventario/producto-ficha"

export const metadata = { title: "Producto | Inventario | AgroMonitor" }

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProductoFicha id={id} />
}
