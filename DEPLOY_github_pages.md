# Publicar el experimento en GitHub Pages

Este paquete es el experimento jsPsych completo y **estático** (no necesita
servidor): HTML + JS + CSS + las librerías de jsPsych locales (`lib/`) + los
sonidos (`resources/`). Sirve tal cual en GitHub Pages.

> IMPORTANTE: el `index.html` debe quedar en la **raíz** de lo que publica Pages.
> Sube el CONTENIDO de esta carpeta (no la carpeta dentro de otra carpeta).
> El archivo oculto **`.nojekyll`** ya está incluido y es necesario (evita que
> Pages ignore archivos; fue parte del problema que tuviste antes).

## Opción A — Interfaz web de GitHub (sin usar la terminal)
1. En GitHub crea un repositorio nuevo (público), por ejemplo `castigo-demo`.
2. En el repo: "Add file" → "Upload files" → arrastra TODO el contenido de esta
   carpeta (index.html, task.css, los .js, y las carpetas lib/ y resources/).
   - Si el `.nojekyll` no se sube por ser oculto, créalo: "Add file" →
     "Create new file" → nombre `.nojekyll` → deja vacío → Commit.
3. Commit.
4. Settings → Pages → "Build and deployment" → Source: **Deploy from a branch** →
   Branch: `main` / carpeta `/ (root)` → Save.
5. Espera 1–3 min y abre: `https://<tu-usuario>.github.io/castigo-demo/`
   (si no carga, refresca con Ctrl+F5 / Cmd+Shift+R).

## Opción B — Terminal (git)
```bash
cd <esta-carpeta>
git init && git add -A && git commit -m "Experimento castigo (jsPsych)"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/castigo-demo.git
git push -u origin main
```
Luego habilita Pages igual que en el paso 4 de la Opción A.

## Enlaces para compartir (según el modo en la URL)
- **Para mostrar en CLASES (recomendado):** versión corta (~5 min), en español,
  SIN banner ni pantallas de desarrollador, con avance manual con la barra
  espaciadora (tú controlas el ritmo):
  `https://<tu-usuario>.github.io/castigo-demo/?test_mode=clase`
  En este modo, durante cualquier fase puedes **presionar la barra espaciadora
  para saltar a la siguiente fase** (así no esperas los 45 s de cada fase ni todo
  el bloque de contracondicionamiento). Un aviso en pantalla lo recuerda. Esto
  funciona SOLO en `?test_mode=clase`, nunca en el experimento real.
- Experimento completo real (sin parámetros, ~18–20 min):
  `https://<tu-usuario>.github.io/castigo-demo/`
- Modo desarrollador (corto, auto-avanza, con banner "NOT SCIENTIFIC DATA"):
  `https://<tu-usuario>.github.io/castigo-demo/?test_mode=smoke`

Los tres modos corren la MISMA tarea (5 fases, RI-15, FR 5, contracondicionamiento
con grupos al azar). El modo `clase` solo acorta las fases (45 s) y usa 3 + 3
ensayos de contracondicionamiento en vez de 12 + 12.

## IMPORTANTE sobre los datos
En GitHub Pages el experimento **descarga el CSV en el navegador de quien lo juega**
(no se recolecta en ningún servidor). Sirve perfecto como **demo jugable por link**
o para clases, pero NO para recolectar datos de forma centralizada. Para recolección
real se usa Pavlovia o un servidor propio.

## Si GitHub Pages vuelve a fallar
Ya te había quedado "colgado" antes. Alternativa instantánea y confiable:
**Netlify Drop** — entra a https://app.netlify.com/drop y arrastra esta carpeta
completa; te da un enlace al instante, sin configurar nada.
