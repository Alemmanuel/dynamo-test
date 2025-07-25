const express = require("express")
const path = require("path")

const app = express()
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000 // Puerto para el frontend

// Sirve archivos estáticos desde la carpeta actual (frontend/)
app.use(express.static(path.join(__dirname, ".")))

app.listen(FRONTEND_PORT, () => {
  console.log(`Frontend Express escuchando en http://localhost:${FRONTEND_PORT}`)
  console.log(`Accede al frontend en: http://localhost:${FRONTEND_PORT}/index.html`)
})
