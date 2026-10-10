// Pedidos que pueden chocar con la carencia sanitaria (bajas por venta, DT-e a faena):
// si el servidor pide confirmar (409 "bajo_retiro_confirmar"), se pregunta al usuario y
// se reintenta con el campo de confirmación. Un 409 "bajo_retiro" (faena) no se confirma.

export async function postConRetiro(url: string, body: Record<string, unknown>, campoConfirmacion: "aceptarRetiro" | "confirmarRetiro") {
  const enviar = (extra: Record<string, unknown> = {}) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) })
  let res = await enviar()
  let json = await res.json().catch(() => ({}))
  if (res.status === 409 && json.codigo === "bajo_retiro_confirmar") {
    if (!window.confirm(`${json.error}\n\n¿Continuar?`)) throw new Error("Operación cancelada por carencia sanitaria")
    res = await enviar({ [campoConfirmacion]: true })
    json = await res.json().catch(() => ({}))
  }
  if (!res.ok) throw new Error(json.error || "No se pudo registrar")
  return json
}
