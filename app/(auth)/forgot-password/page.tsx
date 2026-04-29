"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Sprout, AlertCircle, Mail, ArrowLeft, CheckCircle2, Copy } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar la solicitud")
      }

      setSuccess(true)
      if (data._devToken) {
        setDevToken(data._devToken)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al procesar la solicitud"
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-emerald-100">
              <Mail className="h-10 w-10 text-emerald-600" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            Revisa tu email
          </CardTitle>
          <CardDescription className="text-gray-600">
            Si <span className="font-medium">{email}</span> esta registrado,
            recibiras un enlace para restablecer tu contrasena.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {devToken && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Solo visible en desarrollo:
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/reset-password?token=${devToken}&email=${encodeURIComponent(email)}`}
                  className="text-sm text-amber-700 underline hover:text-amber-900 break-all"
                >
                  Ir a restablecer contrasena
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => navigator.clipboard.writeText(devToken)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-500 text-center">
            El enlace expira en 1 hora. Si no lo ves, revisa tu carpeta de spam.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full text-gray-700 border-gray-300">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesion
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-emerald-100">
            <Sprout className="h-10 w-10 text-emerald-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">
          Recuperar contrasena
        </CardTitle>
        <CardDescription className="text-gray-600">
          Ingresa tu email y te enviaremos instrucciones para restablecer tu
          contrasena
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar instrucciones"
            )}
          </Button>

          <Link href="/login" className="w-full">
            <Button
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800"
              type="button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesion
            </Button>
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
