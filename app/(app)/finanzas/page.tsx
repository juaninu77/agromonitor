import { redirect } from "next/navigation"
export default function FinanzasPage() {
  redirect("/administracion?modulo=comprobantes")
}
