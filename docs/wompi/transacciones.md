la docuemntacion de wompi dice lo siguiente acerca de transacciones

Transacciones
¿Qué es una transacción?
Una transacción representa un movimiento de dinero entre tu cliente y tu comercio. Es el corazón del sistema de pagos, donde se autoriza, procesa y registra cada operación de pago.

Nota
Los siguientes parámetros son o no obligatorios por la integración vía API y la obligatoriedad de parámetros varia con la integración vía widget o checkout.

Crear una transacción
Para crear una transacción por medio de tu integración vía API, debes realizar una petición POST al endpoint /transactions con los datos de la operación que deseas procesar.

Endpoint
POST /v1/transactions

Autenticación requerida
Debes utilizar tu llave privada como Bearer token en el header de autenticación:

Authorization: Bearer {your_private_key}

Parámetros obligatorios
Parámetro	Tipo	Descripción
acceptance_token	string	Token de aceptación obtenido desde Tokens de Aceptación
amount_in_cents	integer	Monto de la transacción en centavos. Por ejemplo, 10000 = $100 COP
currency	string	Moneda de la transacción. La única moneda disponible actualmente es COP (pesos colombianos).
customer_email	string	Email del cliente para envío de comprobante
payment_method	object	Objeto con los detalles del método de pago según su tipo
reference	string	Referencia única de la transacción en tu sistema (máximo 255 caracteres). Debe ser única por transacción
signature	string	Firma de integridad para validar la transacción
Parámetros opcionales
Parámetro	Tipo	Descripción
customer_data	object	Datos adicionales del cliente (nombre, teléfono, dirección, etc.)
redirect_url	string	URL a donde redireccionar al cliente después del pago
ip	string	Dirección IP del dispositivo desde el cual se realiza la transacción
Importante
Para información detallada sobre cómo generar la firma de integridad, consulta la guía en Widget & Checkout Web - Genera una firma de integridad.

Ejemplo de solicitud - Tarjeta de Crédito
{
  "amount_in_cents": 50000,
  "currency": "COP",
  "customer_email": "juan@example.com",
  "payment_method": {
    "type": "CARD",
    "token": "tok_prod_1_BBb749EAB32e97a2D058Dd538a608301",
    "installments": 1
  },
  "signature": "37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5",
  "payment_method_type": "CARD",
  "reference": "ORDER-2024-001",
  "acceptance_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "ip": "192.168.1.100"
}

Response - Transacción creada
Una transacción creada exitosamente retorna un código 201 con los siguientes datos:

{
  "data": {
    "id": "1292-1602113476-10985",
    "reference": "ORDER-2024-001",
    "created_at": "2024-01-15T14:30:45.000Z",
    "amount_in_cents": 50000,
    "currency": "COP",
    "customer_email": "juan@example.com",
    "payment_method_type": "CARD",
    "status": "PENDING",
    "status_message": "La transacción está siendo procesada",
    "merchant": {
      "id": "pub_prod_xxx",
      "name": "Mi Comercio",
      "legal_name": "Mi Comercio SAS"
    },
    "payment_method": {
      "type": "CARD",
      "brand": "VISA",
      "last_four": "4242"
    }
  }
}

Estados de una transacción
Una transacción puede tener los siguientes estados:

Estado	Descripción
PENDING	La transacción fue creada pero aún está siendo procesada
APPROVED	La transacción fue aprobada y el pago se completó exitosamente
DECLINED	La transacción fue rechazada (fondos insuficientes, datos inválidos, etc.)
VOIDED	La transacción fue anulada (solo aplica para tarjetas de crédito/débito)
ERROR	Ocurrió un error durante el procesamiento
Importante
Una transacción recién creada siempre tiene el estado PENDING. Debes hacer polling o usar webhooks para verificar el estado final de la transacción.

Verificar el estado de una transacción
Para consultar el estado actual de una transacción, usa el endpoint:

GET /v1/transactions/{transaction_id}

Consulta de estado
Puedes verificar el estado de una transacción en cualquier momento usando tu llave pública.

Ejemplo de request
curl -X GET "https://production.wompi.co/v1/transactions/1292-1602113476-10985" \
  -H "Authorization: Bearer pub_prod_xxx"

Ejemplo de respuesta
{
  "data": {
    "id": "1292-1602113476-10985",
    "reference": "ORDER-2024-001",
    "status": "APPROVED",
    "amount_in_cents": 50000,
    "currency": "COP",
    "payment_method_type": "CARD",
    "status_message": "Transacción aprobada"
  }
}

Códigos de error comunes
Código	Mensaje	Solución
422	Referencia duplicada	Usa una referencia única para cada transacción
422	Monto inválido	Verifica que amount_in_cents sea un entero positivo
400	Token de aceptación inválido	Genera un nuevo token de aceptación
401	Llave de autenticación inválida	Verifica tu llave privada
400	Método de pago incompleto	Revisa los parámetros requeridos del payment_method
Validación importante
Antes de enviar una transacción a Wompi, asegúrate de validar todos los datos requeridos en tu lado del cliente y servidor. Esto evitará errores de validación.

Trazabilidad y Seguridad
Importancia de capturar la dirección IP
Almacenar la dirección IP del dispositivo desde el cual se origina cada transacción es fundamental para:

Identificación y prevención de fraude: Permite detectar patrones sospechosos como múltiples transacciones desde ubicaciones geográficas imposibles en corto tiempo y facilita la implementación de reglas de detección de anomalías basadas en ubicación.
Trazabilidad: Mantén un registro completo del origen de cada transacción para auditoría.
Recomendación de seguridad
Siempre captura la IP en tu servidor backend. Si utilizas un proxy o balanceador de carga, asegúrate de que el header X-Forwarded-For esté configurado correctamente.

Mejores prácticas
1. Usa referencias únicas
Cada transacción debe tener una referencia única. Te recomendamos usar un formato que incluya tu número de pedido y un timestamp:

ORDER-2024-001-1705330245

2. Implementa polling
Ya que ningún método de pago es síncrono, implementa polling para verificar el estado:

const checkStatus = async (transactionId) => {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutos con intervalos de 5 segundos
  
  const poll = setInterval(async () => {
    const response = await fetch(`/v1/transactions/${transactionId}`, {
      headers: { 'Authorization': `Bearer ${PUBLIC_KEY}` }
    });
    
    const { data } = await response.json();
    
    if (['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'].includes(data.status)) {
      clearInterval(poll);
      console.log('Status final:', data.status);
      return data;
    }
    
    attempts++;
    if (attempts >= maxAttempts) {
      clearInterval(poll);
      console.log('Timeout en la consulta');
    }
  }, 5000);
};

3. Almacena información de transacciones
Mantén un registro de las transacciones en tu base de datos con:

ID de la transacción
Referencia
Estado
Monto
Método de pago
Dirección IP del dispositivo
Fecha/hora
E información adicional que consideres sea valiosa para tu negocio.
4. Maneja errores gracefully
Siempre valida los datos antes de enviar la transacción y maneja errores de forma apropiada:

try {
  const response = await fetch('/v1/transactions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUBLIC_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(transactionData)
  });
  
  if (response.status === 201) {
    const { data } = await response.json();
    // Transacción creada exitosamente
  } else if (response.status === 422) {
    const error = await response.json();
    // Validación fallida - datos inválidos
    console.error('Validation error:', error);
  }
} catch (error) {
  console.error('Network error:', error);
}

Métodos de pago soportados
Wompi soporta múltiples métodos de pago. Para más información detallada sobre los datos específicos de cada método, consulta la guía completa en Métodos de Pago.

Anular una transacción
Para anular una transacción de tarjeta (solo disponible para ciertos estados), usa:

POST /v1/transactions/{transaction_id}/void

Requiere tu llave privada.

curl -X POST "https://production.wompi.co/v1/transactions/1292-1602113476-10985/void" \
  -H "Authorization: Bearer priv_prod_xxx"

  