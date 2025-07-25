import os
import json
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

# Carga las variables de entorno del archivo .env
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("Variables de entorno cargadas desde .env")
except ImportError:
    print("python-dotenv no está instalado. Las variables de entorno deben estar configuradas en el sistema.")

# --- Nombre de la tabla hardcodeado ---
DYNAMODB_TABLE_NAME = "dynamo-test"
# -------------------------------------

# --- Depuración de variables de entorno ---
print(f"DEBUG: AWS_ACCESS_KEY_ID (primeros 4 chars): {os.environ.get('AWS_ACCESS_KEY_ID', 'N/A')[:4]}****")
print(f"DEBUG: AWS_SECRET_ACCESS_KEY (primeros 4 chars): {os.environ.get('AWS_SECRET_ACCESS_KEY', 'N/A')[:4]}****")
print(f"DEBUG: AWS_REGION: {os.environ.get('AWS_REGION', 'N/A')}")
print(f"DEBUG: DYNAMODB_TABLE_NAME (hardcodeado): {DYNAMODB_TABLE_NAME}")
# ------------------------------------------

try:
    dynamodb_client = boto3.client('dynamodb', region_name=os.environ.get('AWS_REGION'))
    dynamodb_resource = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION'))
    print("DEBUG: Cliente y recurso de DynamoDB inicializados correctamente.")
except Exception as e:
    print(f"ERROR: No se pudo inicializar el cliente/recurso de DynamoDB. Verifica tus credenciales y región. Error: {e}")
    exit(1)

def check_and_create_table(table_name, client):
    """
    Verifica si la tabla de DynamoDB existe y la crea si no.
    Retorna True si la tabla existe o fue creada exitosamente, False en caso contrario.
    """
    try:
        client.describe_table(TableName=table_name)
        print(f"Tabla '{table_name}' ya existe.")
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Tabla '{table_name}' no encontrada. Creándola...")
            try:
                client.create_table(
                    TableName=table_name,
                    KeySchema=[
                        {'AttributeName': 'id', 'KeyType': 'HASH'}
                    ],
                    AttributeDefinitions=[
                        {'AttributeName': 'id', 'AttributeType': 'S'}
                    ],
                    ProvisionedThroughput={
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                )
                print(f"Creación de la tabla '{table_name}' iniciada. Esperando a que esté activa...")
                waiter = client.get_waiter('table_exists')
                waiter.wait(TableName=table_name, WaiterConfig={'Delay': 5, 'MaxAttempts': 30})
                print(f"Tabla '{table_name}' ahora está activa.")
                return True
            except ClientError as create_error:
                print(f"ERROR: Falló la creación de la tabla '{table_name}'. Mensaje: {create_error.response['Error']['Message']}")
                print(f"Código de error: {create_error.response['Error']['Code']}")
                print("Posible causa: Permisos insuficientes (dynamodb:CreateTable) o nombre de tabla inválido.")
                return False
        else:
            print(f"ERROR: Error al describir la tabla '{table_name}'. Mensaje: {e.response['Error']['Message']}")
            print(f"Código de error: {e.response['Error']['Code']}")
            return False
    except Exception as e:
        print(f"ERROR: Ocurrió un error inesperado en check_and_create_table: {e}")
        return False

def put_item_to_dynamodb(item_data):
    """
    Envía un ítem a la tabla de DynamoDB.
    """
    table_name = DYNAMODB_TABLE_NAME

    if not check_and_create_table(table_name, dynamodb_client):
        print("No se pudo asegurar la existencia de la tabla. No se enviará el ítem.")
        return

    if 'id' not in item_data:
        print("Error: Falta 'id' en los datos del ítem. DynamoDB requiere una clave primaria.")
        return

    try:
        table = dynamodb_resource.Table(table_name)
        response = table.put_item(Item=item_data)
        
        print(f"Datos enviados exitosamente a DynamoDB: {item_data}")
        print(f"Respuesta de DynamoDB (put_item): {json.dumps(response, indent=2)}")
    except ClientError as e:
        print(f"ERROR: Falló el envío de datos a DynamoDB. Mensaje: {e.response['Error']['Message']}")
        print(f"Código de error: {e.response['Error']['Code']}")
        print("Posible causa: Permisos insuficientes (dynamodb:PutItem) o problema con el ítem.")
    except Exception as e:
        print(f"ERROR: Ocurrió un error inesperado en put_item_to_dynamodb: {e}")

if __name__ == '__main__':
    # Bucle para enviar 5 ítems
    for i in range(1, 6): # De 1 a 5
        item_to_send = {
            'id': f'item-python-{os.urandom(4).hex()}-{i}', # ID único para cada ítem
            'nombre': f'Producto de Prueba Python {i}',
            'descripcion': f'Este es el ítem número {i} enviado desde un script Python local.',
            'precio': Decimal(f'{75.50 + i * 0.10}'), # Precio ligeramente diferente para cada uno
            'fechaCreacion': os.urandom(4).hex()
        }
        print(f"\n--- Enviando ítem {i} ---")
        put_item_to_dynamodb(item_to_send)
