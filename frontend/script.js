document.addEventListener("DOMContentLoaded", () => {
  const sendDataBtn = document.getElementById("sendDataBtn")
  const readDataBtn = document.getElementById("readDataBtn")
  const sendResponseTextarea = document.getElementById("sendResponse")
  const readResponseTextarea = document.getElementById("readResponse")
  const itemListDiv = document.getElementById("itemList")

  // --- URL BASE DEL BACKEND ---
  const BACKEND_URL = "http://localhost:3001"
  // --------------------------

  let itemCounter = 0 // Para generar IDs únicos

  // Función para enviar datos
  sendDataBtn.addEventListener("click", async () => {
    sendResponseTextarea.value = "Enviando datos..."
    itemListDiv.innerHTML = "" // Limpiar lista al enviar

    const itemsToSend = []
    for (let i = 0; i < 5; i++) {
      itemCounter++
      itemsToSend.push({
        id: `item-frontend-${Date.now()}-${itemCounter}`,
        nombre: `Producto Web ${itemCounter}`,
        descripcion: `Descripción del producto ${itemCounter} desde el frontend.`,
        precio: Number.parseFloat((100.0 + itemCounter * 0.5).toFixed(2)), // Asegurar 2 decimales
        cantidad: Math.floor(Math.random() * 100) + 1,
        fecha: new Date().toISOString(),
      })
    }

    const allResponses = []
    for (const item of itemsToSend) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item),
        })
        const data = await response.json()
        allResponses.push({ item: item.id, status: response.status, response: data })
      } catch (error) {
        allResponses.push({ item: item.id, status: "Error", response: error.message })
      }
    }
    sendResponseTextarea.value = JSON.stringify(allResponses, null, 2)
  })

  // Función para leer datos
  readDataBtn.addEventListener("click", async () => {
    readResponseTextarea.value = "Leyendo datos..."
    itemListDiv.innerHTML = ""

    try {
      const response = await fetch(`${BACKEND_URL}/api/items`)
      const data = await response.json()

      readResponseTextarea.value = JSON.stringify(data, null, 2)

      if (data.items && data.items.length > 0) {
        data.items.forEach((item) => {
          const itemDiv = document.createElement("div")
          itemDiv.className = "item"
          itemDiv.innerHTML = `
                        <strong>ID:</strong> ${item.id}<br>
                        <strong>Nombre:</strong> ${item.nombre || "N/A"}<br>
                        <strong>Descripción:</strong> ${item.descripcion || "N/A"}<br>
                        <strong>Precio:</strong> ${item.precio || "N/A"}<br>
                        <strong>Cantidad:</strong> ${item.cantidad || "N/A"}<br>
                        <strong>Fecha:</strong> ${item.fecha || "N/A"}
                    `
          itemListDiv.appendChild(itemDiv)
        })
      } else {
        itemListDiv.innerHTML = "<p>No se encontraron ítems en la tabla.</p>"
      }
    } catch (error) {
      readResponseTextarea.value = `Error al leer datos: ${error.message}`
      console.error("Error al leer datos:", error)
    }
  })
})
