import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Moon, Sun } from "lucide-react";

type Tema = "light" | "dark";

function temaInicial(): Tema {
  if (typeof window === "undefined") return "light";
  const guardado = window.localStorage.getItem("sistema-taller-theme");
  if (guardado === "light" || guardado === "dark") return guardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    try {
      window.localStorage.setItem("sistema-taller-theme", tema);
    } catch {
      // ignore
    }
  }, [tema]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
      title={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-label="Alternar tema claro/oscuro"
    >
      {tema === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
