import { AdministracionPanel } from "@/components/administracion/administracion-panel"
import { moduloSchema } from "@/lib/administracion/validation"
export default async function AdministracionPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const params = await searchParams
  const parsed = moduloSchema.safeParse(params.modulo)
  return <AdministracionPanel initialModulo={parsed.success ? parsed.data : "patrimonio"} />
}
