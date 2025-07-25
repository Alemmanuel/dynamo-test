// Carga las variables de entorno del archivo .env
require("dotenv").config()

const express = require("express")
const cors = require("cors") // Importa el paquete CORS
const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} = require("@aws-sdk/client-dynamodb")
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb")
// const { Decimal } = require("decimal.js") // Ya no necesitamos importar decimal.js aquí

const app = express()
const BACKEND_PORT = process.env.BACKEND_PORT || 3001 // Puerto para el backend
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000" // Origen permitido para CORS

// --- Nombre de la tabla hardcodeado ---
const DYNAMODB_TABLE_NAME = "dynamo-test"
// -------------------------------------

// Las credenciales de AWS y la región se recogen automáticamente de las variables de entorno
const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const docClient = DynamoDBDocumentClient.from(client)

// Configuración de CORS
app.use(
  cors({
    origin: FRONTEND_ORIGIN, // Permite solicitudes solo desde este origen
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Métodos HTTP permitidos
    allowedHeaders: ["Content-Type", "Authorization"], // Cabeceras permitidas
    credentials: true, // Permite el envío de cookies o cabeceras de autorización
  }),
)

// Middleware para parsear JSON en las solicitudes
app.use(express.json())

/**
 * Verifica si la tabla de DynamoDB existe y la crea si no.
 * @param {string} tableName - El nombre de la tabla a verificar/crear.
 * @param {DynamoDBClient} dbClient - La instancia del cliente de DynamoDB.
 */
async function checkAndCreateTable(tableName, dbClient) {
  try {
    await dbClient.send(new DescribeTableCommand({ TableName: tableName }))
    console.log(`Tabla '${tableName}' ya existe.`)
    return true
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      console.log(`Tabla '${tableName}' no encontrada. Creándola...`)
      try {
        await dbClient.send(
          new CreateTableCommand({
            TableName: tableName,
            KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
            AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          }),
        )
        console.log(`Creación de la tabla '${tableName}' iniciada. Esperando a que esté activa...`)
        await waitUntilTableExists({ client: dbClient, maxWaitTime: 180 }, { TableName: tableName })
        console.log(`Tabla '${tableName}' ahora está activa.`)
        return true
      } catch (create_error) {
        console.error(`ERROR: Falló la creación de la tabla '${tableName}'. Mensaje: ${create_error.message}`)
        console.error(`Código de error: ${create_error.name}`)
        return false
      }
    } else {
      console.error(`ERROR: Error al describir la tabla '${tableName}'. Mensaje: ${error.message}`)
      console.error(`Código de error: ${error.name}`)
      return false
    }
  }
}

// Endpoint para enviar datos a DynamoDB (POST)
app.post("/api/items", async (req, res) => {
  try {
    const itemData = req.body

    if (!itemData.id) {
      return res.status(400).json({ error: "Missing 'id' in the request body. DynamoDB requires a primary key." })
    }

    // --- ELIMINAMOS LA CONVERSIÓN MANUAL A DECIMAL AQUÍ ---
    // El DynamoDBDocumentClient maneja los números de JavaScript automáticamente.
    const processedItem = itemData
    // -----------------------------------------------------

    if (!(await checkAndCreateTable(DYNAMODB_TABLE_NAME, client))) {
      return res.status(500).json({ error: "Failed to ensure DynamoDB table exists." })
    }

    const command = new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: processedItem,
    })

    const response = await docClient.send(command)
    res.status(200).json({ message: "Data successfully sent to DynamoDB", data: itemData, response })
  } catch (error) {
    console.error("Error sending data to DynamoDB:", error)
    res.status(500).json({ error: "Failed to send data to DynamoDB", details: error.message })
  }
})

// Endpoint para leer datos de DynamoDB (GET)
app.get("/api/items", async (req, res) => {
  try {
    if (!(await checkAndCreateTable(DYNAMODB_TABLE_NAME, client))) {
      return res.status(500).json({ error: "Failed to ensure DynamoDB table exists." })
    }

    const command = new ScanCommand({
      TableName: DYNAMODB_TABLE_NAME,
    })

    const response = await docClient.send(command)
    res
      .status(200)
      .json({ message: "Data successfully retrieved from DynamoDB", items: response.Items, count: response.Count })
  } catch (error) {
    console.error("Error reading data from DynamoDB:", error)
    res.status(500).json({ error: "Failed to read data from DynamoDB", details: error.message })
  }
})

// Inicia el servidor
app.listen(BACKEND_PORT, () => {
  console.log(`Backend Express escuchando en http://localhost:${BACKEND_PORT}`)
  console.log(`Permitiendo solicitudes desde el frontend en: ${FRONTEND_ORIGIN}`)
})
