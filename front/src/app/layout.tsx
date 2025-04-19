'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import '@/styles/globals.css'
import { ConfigProvider } from 'antd'
import { Calendar, ChevronDown, ChevronLeft, PawPrint, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'
//export const dynamicParams = true
//export const runtime = 'edge'

const NAVIGATION_ITEMS = [
  { href: '/', icon: Calendar, label: 'Calendario' },
  { href: '/usuarios', icon: Users, label: 'Usuarios' },
  { href: '/caballos', icon: PawPrint, label: 'Caballos' },
  { href: '/gestion', icon: Settings, label: 'Gestión' },
]
const CREATE_MENU_ITEMS = [
  { href: '/crear/usuario', label: 'Usuario' },
  { href: '/crear/caballo', label: 'Caballo' },
  { href: '/editar', label: 'Editar' },
  { href: '/crear/concepto', label: 'Concepto' },
  //{ href: '/informe', label: 'Informe' },
]

// Separate client-only component for greeting
const Greeting = () => {
  const [greeting, setGreeting] = React.useState('')

  React.useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(
      hour < 12
        ? 'Buenos días'
        : hour < 18
          ? 'Buenas tardes'
          : 'Buenas noches'
    )
  }, [])

  return <h1 className="text-xl font-semibold">{greeting}</h1>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Ensure we only render after component mounts on client
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <html lang="es" className="h-full">
      <body className="h-full">
        <div className="flex h-full flex-col">
          {/* Header */}
          <header className="border-b px-4 h-16 flex items-center justify-between">
            <Greeting />

            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.back()}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Volver
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2" variant='secondary'>
                    Crear
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {CREATE_MENU_ITEMS.map(item => (
                    <DropdownMenuItem key={item.href}>
                      <Link href={item.href} className="w-full">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <nav className="w-64 border-r p-4">
              <ul className="space-y-2">
                {NAVIGATION_ITEMS.map(({ href, icon: Icon, label }) => {
                  const isActive = false // TODO: implement path matching logic
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6">
              <ConfigProvider>
                {children}
              </ConfigProvider>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}