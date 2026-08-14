Métodos de pago
Cambio importante en el API
Para la creación de transacciones y fuentes de pago, pensando en la privacidad y el correcto manejo de los datos personales de nuestros usuarios, es ahora obligatorio el uso de Tokens de Aceptación a la hora de crear cualquiera de estos dos recursos a través de nuestro API.

Cada vez que creas una transacción usando nuestro API, tienes la opción de procesar el pago usando distintos métodos de pago. Actualmente se encuentran disponibles los siguientes métodos de pago:

Tarjetas de Crédito o Débito: Permite a tus clientes usar tarjetas de crédito o débito para realizar el pago.
Botón de Transferencia Bancolombia: Permite a tus clientes usar sus cuentas de ahorros o corrientes Bancolombia para realizar el pago.
Nequi: Ofrece a tus clientes la posibilidad de usar su cuenta Nequi desde su celular, para completar el pago.
PSE: Permite a tus clientes realizar el pago usando su cuenta bancaria, de ahorros o corriente de cualquier banco colombiano.
Pago en efectivo en Corresponsales Bancarios Bancolombia: Permite a tus clientes realizar el pago en efectivo en cualquiera de los más de 15.000 Corresponsales Bancarios Bancolombia.
PCOL: Permite a tus clientes realizar el pago redimiendo Puntos Colombia.
BNPL BANCOLOMBIA: Permite a tus clientes optar por un crédito de libre inversión de BANCOLOMBIA, sin intereses, dividido en 4 cuotas mensuales para transacciones superiores a $100,000 pesos.
DAVIPLATA: Proporciona a tus clientes la opción de utilizar su cuenta Daviplata para realizar el pago de forma conveniente.
SU+ PAY: Permite a los usuarios comprar productos o servicios y pagarlos en cuotas, facilitando la gestión financiera y el acceso a una amplia gama de productos.
Para usar un método de pago al hacer POST en el endpoint de /transactions debes:

Especificar el campo payment_method con un objeto JSON que contiene detalles específicos de cada método, descritos más abajo.
Especificar el campo payment_method_type y especifique uno de estos 3 valores: TARJETA, NEQUI o PSE.
Al finalizar el proceso de pago de cualquiera de los métodos disponibles, te recomendamos siempre verificar periódicamente (long polling) el estado de una transacción, esperando un status final (aprobada, rechazada o error), usando el ID de transacción y nuestro API, ya que ninguno de los métodos de pago otorga un resultado síncrono (inmediato). Una transacción recién creada siempre tiene un status: PENDING.

Estados finales de una transacción
El status final posible de una transacción puede ser: APPROVED (aprobada), DECLINED (rechazada), VOIDED (anulada, sólo aplica para transacciones con Tarjeta) o ERROR (si sucedió algún error externo a Wompi autorizando la transacción).

Tarjetas de Crédito o Débito
En Wompi, tus clientes pueden procesar pagos usando tarjetas crédito y débito de las franquicias Visa, MasterCard y American Express, siempre y cuando cuenten con un CVC (Código de Verificación de Tarjeta), usualmente impreso en el reverso de la tarjeta, lo que significa que está habilitada para comprar en internet.

El nombre del método de pago que debes usar al crear la transacción es CARD. Al usar el tipo de método de pago CARD debes tener en cuenta que:

Debes haber tokenizado una tarjeta previamente (instrucciones a continuación)
Debes haber preguntado a tu usuario en cuántas cuotas desea hacer el pago.
¡No guardes nunca la información de una tarjeta!
Desaconsejamos completamente que guardes información sensible de tarjetas. No sólo pones en riesgo la información de tus usuarios sino que puedes enfrentar sanciones económicas y problemas legales. Wompi cuenta con una certificación PCI DSS para al manejo, transmisión y procesamiento seguro de datos de tarjeta, de manera que ningún comercio deba guardar estos datos, usando únicamente los tokens seguros generados.

Tokeniza una tarjeta
Para tokenizar de manera segura una tarjeta debes usar nuestro endpoint (autenticado con tu llave pública):

POST /v1/tokens/cards

A este endpoint, debes enviar la siguiente información de la tarjeta:

{
  "number": "4242424242424242", // Número de la tarjeta
  "cvc": "123", // Código de seguridad de la tarjeta (3 o 4 dígitos según corresponda)
  "exp_month": "08", // Mes de expiración (string de 2 dígitos)
  "exp_year": "28", // Año expresado current 2 dígitos
  "card_holder": "José Pérez" // Nombre del tarjetahabiente
}

A lo que el endpoint responderá:

{
  "status": "CREATED",
  "data": {
    "id": "tok_prod_1_BBb749EAB32e97a2D058Dd538a608301", // TOKEN que debe ser usado para crear la transacción
    "created_at": "2020-01-02T18:52:35.850+00:00",
    "brand": "VISA",
    "name": "VISA-4242",
    "last_four": "4242",
    "bin": "424242",
    "exp_year": "28",
    "exp_month": "08",
    "card_holder": "José Pérez",
    "expires_at": "2020-06-30T18:52:35.000Z"
  }
}


De esta respuesta, el valor del campo "id" es el token que debes usar dentro del método de pago (en este caso "tok_prod_1_BBb749EAB32e97a2D058Dd538a608301"), para posteriormente crear una transacción.

¡No uses un token más de dos veces!
Si necesitas hacer múltiples cobros a una misma tarjeta, utiliza Fuentes de Pago.

Realiza la transacción
Con estos detalles y habiendo consultado al usuario final sobre el número de cuotas ("installments") en las que desea pagar, los campos del método de pago para una nueva transacción con tarjeta de crédito o débito deberían ser los siguientes:

{
  "payment_method": {
    "type": "CARD",
    "installments": 2, // Número de cuotas
    "token": "tok_prod_1_BBb749EAB32e97a2D058Dd538a608301" // Token de la tarjeta de crédito
  }
  // Otros campos de la transacción a crear...
}

Por último, es fundamental verificar periódicamente el estado de una transacción en Wompi desde tu sistema. Para obtener el estado de una transacción, utiliza el ID de transacción y accede al siguiente endpoint:

GET /v1/transactions/<ID_TRANSACCION>

Asegúrate de reemplazar <ID_TRANSACCION> con el ID real de la transacción que deseas consultar. Este endpoint te proporcionará detalles sobre el estado y la información de pago de la transacción.

A continuación se muestra un ejemplo de los campos necesarios para realizar una nueva transacción con tarjeta de crédito o débito:

{
  "data": {
    "id": "0101010-0101010101-10101",
    "created_at": "2023-01-17T18:16:06.287Z",
    "amount_in_cents": 1000000,
    "reference": "Prime_102305887219213_108224918",
    "currency": "COP",
    "payment_method_type": "CARD",
    "payment_method": {
      "type": "CARD",
      "extra": {
        "name": "MASTERCARD-0110",
        "brand": "MASTERCARD",
        "last_four": "0110",
        "processor_response_code": "51" // Código de respuesta del procesador y/o emisor de la tarjeta
      },
      "installments": 2
    },
    "redirect_url": null,
    "status": "DECLINED",
    "status_message": "Fondos Insuficientes",
    "merchant": {
      "name": "HULU PRIME",
      "legal_name": " HULU S.A.S.",
      "contact_name": "John Doe",
      "phone_number": "+573001111111",
      "logo_url": null,
      "legal_id_type": "NIT",
      "email": "payins+01codiprime@hulu.com",
      "legal_id": "100111111-01"
    },
    "taxes": []
  },
  "meta": {}
}


En la respuesta, se proporciona el processor_response_code, status y status_message de la transacción.

NOTA: Le recomendamos utilizar el campo processor_response_code para obtener la respuesta del procesador. Además, tenga presente que en la respuesta del endpoint puede recibir campos adicionales en el objeto extra.

Botón de Transferencia Bancolombia
Pago Simple
En Wompi, tus clientes pueden completar el pago de una transacción usando su cuenta de ahorros o corriente Bancolombia. El nombre del método de pago que debes usar al crear la transacción es BANCOLOMBIA_TRANSFER.

Al usar el tipo de método de pago BANCOLOMBIA_TRANSFER debes tener en cuenta lo siguiente:

Tu cliente debe escoger qué tipo de persona es en el campo user_type. Por el momento únicamente está disponible Persona Natural, como PERSON
Debes especificar un nombre de lo que se está pagando en el campo payment_description. Máximo 64 caracteres. No puedes incluir comillas simples en este dato (').
Así, los campos de método de pago una nueva transacción con BANCOLOMBIA_TRANSFER deben ser similares a los siguientes:

{
  "payment_method": {
    "type": "BANCOLOMBIA_TRANSFER",
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
    "ecommerce_url": "https://comercio.co/thankyou_page" // Permite al cliente omitir la pantalla resumen de la transacción de wompi, y redireccionar a un resumen personalizado current el comercio
  }
  // Otros campos de la transacción a crear...
}


Al crear la transacción, debes consultarla continuamente (long polling) hasta que ésta contenga un campo llamado async_payment_url dentro de un objeto extra, que estará dentro de la propiedad payment_method. Una vez la obtengas, debes redireccionar a tu cliente a esta URL para que complete el pago en la respectiva institución financiera (banco). El campo que debes esperar de la transacción se vería como el siguiente:

{
  "payment_method": {
    "type": "BANCOLOMBIA_TRANSFER",
    // Otros campos del payment_method
    "extra": {
      "async_payment_url": "https://..." // URL para redireccionar al cliente
    }
  }
  // Otros campos de la transacción...
}

Compra Recurrente Nuevo
Dentro de la plataforma de Wompi, ofrecemos a tus clientes la posibilidad de permitir pagos recurrentes desde su cuenta Bancolombia. Este servicio es la solución perfecta para quienes buscan comodidad y eficiencia en la gestión de sus pagos periódicos. Esta innovadora opción de pago permite a los clientes autorizar de manera segura cobros automáticos y programados.

Para la creación de una transacción recurrente es nesecario haber creado una fuente de pago como se ve aquí

Con el campo <<ID_FUENTE_DE_PAGO>> procederas a crear la transacción en el caso de que el token se encuentre en estado APPROVED la transacción se realizara sin necesidad de que el cliente se autentique en Bancolombia

{
  "payment_method": {
    "type": "BANCOLOMBIA_TRANSFER",
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
    "ecommerce_url": "https://comercio.co/thankyou_page" // Permite al cliente omitir la pantalla resumen de la transacción de wompi, y redireccionar a un resumen personalizado current el comercio
  },
  "payment_source_id": <<ID_FUENTE_DE_PAGO>>, // ID de la fuente de pago creada previamente
  // Otros campos de la transacción a crear...
}


Al finalizarse el proceso de pago a través de Bancolombia, éste redireccionará a la redirect_url que hayas especificado originalmente en la transacción, para que puedas verificar el resultado de la transacción, nuevamente con un long polling hasta obtener un status final.

Por último, recuerda siempre verificar periódicamente el estado de una transacción en Wompi desde tu sistema usando el ID de transacción y nuestro API, con el endpoint GET /v1/transactions/<ID_DE_TRANSACCION>

Bancolombia QR
Permite a tus clientes usar sus cuentas a la mano de Bancolombia, cuentas de ahorros o corrientes Bancolombia y cuentas de Nequi, a través de la generación de un QR que deberá ser leído por la respectiva app del banco. El nombre del método de pago que debes usar al crear la transacción es BANCOLOMBIA_QR. Debes tener en cuenta que los pagos a través de este medio solo aplican para personas naturales.

Los campos de método de pago para una nueva transacción con BANCOLOMBIA_QR deben ser similares a los siguientes:

{
  "payment_method": {
    "type": "BANCOLOMBIA_QR",
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
    // El siguiente dato SOLO aplica si estás haciendo transacciones en Sandbox:
    "sandbox_status": "APPROVED" // Status final deseado en el Sandbox. Uno de los siguientes: APPROVED, DECLINED o ERROR
  }
  // Otros campos de la transacción a crear...
}


Al crear la transacción, debes consultarla continuamente (long polling) hasta que ésta contenga un campo llamado qr_image y qr_id, que estará dentro de la propiedad payment_method, el cual tendrá la imagen del QR en base64 dentro de un objeto extra.

Una vez la obtengas, puedes renderizar el QR en un tag img de la siguiente manera:

<img src="data:image/svg+xml;base64 + ${qr_image}"/>

El campo que debes esperar de la transacción se vería como el siguiente:

{
  "payment_method": {
    "type": "BANCOLOMBIA_QR",
    // Otros campos del payment_method
    "extra": {
      "qr_id": "a3827b90-501b-11ed-ae9b-3156df51ed75", // ID del código QR
      "qr_image": "PD94bWwgdmVyc2lvbj0iK.....", // Imágen del código QR codificada en Base64
      "external_identifier": "d00000000000" //Id de conciliación una vez hecho el pago
    }
  }
  // Otros campos de la transacción...
}

Al finalizarse el proceso de pago a través de BANCOLOMBIA_QR, éste redireccionará a la redirect_url que hayas especificado originalmente en la transacción, para que puedas verificar el resultado de la transacción, nuevamente con un long polling hasta obtener un status final.

Por último, recuerda siempre verificar periódicamente el estado de una transacción en Wompi desde tu sistema usando el ID de transacción y nuestro API, con el endpoint GET /v1/transactions/<ID_DE_TRANSACCION>

Nequi
En Wompi, tus clientes pueden completar el pago de una transacción usando su cuenta Nequi en su celular. El nombre del método de pago que debes usar al crear la transacción es NEQUI.

Al usar el tipo de método de pago NEQUI solamente debes solicitarle a tu cliente un número celular colombiano, de 10 dígitos, que esté registrado con Nequi, para enviarlo dentro de la información necesaria para nuestro API. Recuérdale a tu cliente que debe contar con la app de Nequi instalada en su celular para poder completar el pago usando este método.

Teniendo el número celular, los campos de método de pago una nueva transacción con Nequi deben ser similares a los siguientes:

{
  "payment_method": {
    "type": "NEQUI"
    "phone_number": "3107654321" // Número celular de la cuenta Nequi
  }
  // Otros campos de la transacción a crear...
}

Al crear la transacción, debes indicarle a tus clientes que recibirán una notificación push de parte de Nequi en su celular, en la cual deberán aceptar o rechazar dicha transacción. Este resultado se verá reflejado en Wompi en cuestión de segundos, luego de que el usuario haya tomado acción.

Por último, recuerda siempre verificar periódicamente el estado de una transacción en Wompi desde tu sistema usando el ID de transacción y nuestro API.

PSE
En Wompi, tus clientes pueden completar el pago de una transacción usando su cuenta de ahorros o corriente de cualquier banco colombiano, a través de PSE. El nombre del método de pago que debes usar al crear la transacción es PSE.

Al usar el tipo de método de pago PSE debes tener en cuenta lo siguiente:

Debes obtener primero una lista de instituciones financieras usando nuestro API, en el endpoint GET /v1/pse/financial_institutions
Tu cliente debe escoger en qué institución (banco) quiere realizar el pago
Tu cliente debe especificar el tipo de persona que es: natural (0) o jurídica (1).
Tu cliente debe especificar su tipo y número de documento
Tu cliente debe especificar su nombre completo
Tu cliente debe especificar una cuenta de correo electrónico
Tu cliente debe especificar un número de teléfono
Finalmente debes especificar la descripción de lo que tu cliente está pagando, máximo 64 caracteres
Luego de que tu cliente haya escogido una institución financiera, usa su código (code) como el identificador que vas a enviar al crear la transacción. Así, los campos de método de pago de una nueva transacción tipo PSE deben ser similares a los siguientes:

{
  "customer_email": "cliente@example.com",
  "payment_method": {
    "type": "PSE",
    "user_type": 0, // Tipo de persona, natural (0) o jurídica (1)
    "user_legal_id_type": "CC", // Tipo de documento, CC o NIT
    "user_legal_id": "1099888777", // Número de documento
    "financial_institution_code": "1", // Código (`code`) de la institución financiera
    "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Descripción de lo que está pagando. Máximo 64 caracteres
  },
  "customer_data": {
    "phone_number": "573145678901",
    "full_name": "Nombre(s) Apellido(s)"
  }
  // Otros campos de la transacción a crear...
}


A tener en cuenta: Con el fin de mitigar el fraude en el servicio PSE, se han definido acciones adicionales que deben ser implementadas por todas las empresas vinculadas a la categoría de Servicios Financieros. Entre estas acciones se encuentra la inclusión de tres campos obligatorios en la trama transaccional, relacionados con la dirección IP del usuario, la fecha de apertura del producto y la identificación del beneficiario.

De cumplir con la descripción anterior se recomienda enviar el objeto payment_method con los campos reference_one, reference_two, reference_three

{
  // Otros campos de la transacción...
  "payment_method": {
    "type": "PSE",
    "user_type": 0,
    "user_legal_id_type": "CC",
    "user_legal_id": "1999888777",
    "financial_institution_code": "1",
    "payment_description": "Pago a Tienda Wompi",
    "reference_one": "192.168.0.1", // Dirección IP del cliente pagador, en caso de no enviarla se tomará la ip de origen de la petición
    "reference_two": "20240101",    // Fecha de apertura del producto en formato yyyymmdd
    "reference_three": "123456"   // Número de documento del beneficiario del producto financiero
  }
}


Al crear la transacción, debes consultarla continuamente (long polling) hasta que ésta contenga un campo llamado async_payment_url dentro de un objeto extra, que estará dentro de la propiedad payment_method. Una vez la obtengas, debes redireccionar a tu cliente a esta URL para que complete el pago en la respectiva institución financiera (banco). El campo que debes esperar de la transacción se vería como el siguiente:

{
  "payment_method": {
    // Otros campos del payment_method
    "extra": {
      "async_payment_url": "https://..." // URL para redireccionar al cliente
    }
  }
  // Otros campos de la transacción...
}

Al finalizarse el proceso de pago a través de PSE, éste redireccionará a la redirect_url que hayas especificado originalmente en la transacción, para que puedas verificar el resultado de la transacción, nuevamente con un long polling hasta obtener un status final.

Por último, recuerda siempre verificar periódicamente el estado de una transacción en Wompi desde tu sistema usando el ID de transacción y nuestro API, con el endpoint GET /v1/transactions/<ID_DE_TRANSACCION>

Pago en efectivo en Corresponsales Bancarios Bancolombia
Este medio de pago le permite al tus clientes acercarce a cualquier Corresponsal Bancario Bancolombia y realizar el pago en efectivo. Para generar una intención de pago en efectivo debes seguir los siguientes pasos:

Paso 1: Crea la transacción
Debes crear una transacción insertando BANCOLOMBIA_COLLECT en el campo type de payment_method:

{
  "payment_method": {
    "type": "BANCOLOMBIA_COLLECT" // medio de pago current corresponsal bancario
  }
  // Otros campos de la transacción a crear...
}

Como respuesta obtendrás una transacción con el campo status en PENDING.

Paso 2: Consulta la transacción creada
Después de crear la transacción debes hacer long polling a la misma usando el endpoint el endpoint GET /v1/transactions/<ID_DE_TRANSACCION> hasta obtner la información de convenio que te será presentada de la siguiente manera en el campo payment_method en el objeto extra de la transacción:

{
  "payment_method": {
    "type": "BANCOLOMBIA_COLLECT",
    "extra": {
        "business_agreement_code": "12345", // Esto current un valor de ejemplo
        "payment_intention_identifier": "65770204276" // Esto current un valor de ejemplo
    }
  // El resto de la información de transacción...
}

Paso 3: Comparte la información de pago
Una vez tengas la información de pago como se muestra en el paso anterior, puedes compartir con tus clientes el número de convenio business_agreement_code y el número de intención de pago payment_intention_identifier, para que estos efectúen el pago en cualquier Corresponsal Bancario Bancolombia.

Puntos Colombia (PCOL)
En Wompi, tus clientes pueden completar el pago de una transacción usando pago total con Puntos Colombia o Puntos + un segundo metodo de pago: Tarjetas de Crédito o Débito, Botón de Transferencia Bancolombia, Nequi, PSE. Para crear una transacción con pago con Puntos Colombia, el nombre del método de pago que debes usar es PCOL.

Paso 1: Crea la transacción con Método de pago PCOL
Para crear una transacción de Pago con Puntos (PCOL), los campos del método de pago deben ser similares a los siguientes:

{
  "customer_email": "myemail@mail.com",
  "customer_data": {
    "phone_number": "+573121111111",
    "full_name": "Nombre Apellido"
  },
  "payment_method": {
    "type": "PCOL"
  }
  // Otros campos de la transacción a crear...
}

Al crear la transacción, debes consultarla continuamente (long polling) hasta que ésta contenga un campo llamado async_payment_url dentro de un objeto extra, que estará dentro de la propiedad payment_method. Una vez la obtengas, debes redireccionar a tu cliente a esta URL para que realice la redención de Puntos. El campo que debes esperar de la transacción se ve como el siguiente:

{
  "payment_method": {
    // Otros campos del payment_method
    "extra": {
      "async_payment_url": "https://..." // URL para redireccionar al cliente
    }
  }
  // Otros campos de la transacción...
}

Paso 2: Validar resultado de la redención en Puntos Colombia
Al finalizarse el proceso de redención a través de PCOL, éste redireccionará a la redirect_url que hayas especificado originalmente en la transacción, para que puedas verificar el resultado de la redención, e identificar si el pago con Puntos fue completo o parcial.

Para esto, al recibir la redirección se debe hacer nuevamente un long polling de la transacción hasta obtener en el campo status diferente de PENDING y los campos point_redeemed, redeemed_amount_in_cents_pcol y remaining_amount_in_cents dentro de un objeto extra, que estará dentro de la propiedad payment_method:

{
  "payment_method": {
    "type": "PCOL",
    "extra": {
      "async_payment_url": "https://...", // URL para redireccionar al cliente
      "points_redeemed": 1000, // Puntos Colombia redimidos
      "remaining_amount_in_cents": 0, // Saldo pendiente por pagar con segundo medio de pago
      "redeemed_amount_in_cents_pcol": 700000 // Dinero redimido
    }
  },
  "status": "APPROVED"
  // Otros campos de la transacción...
}

Debes validar el valor recibido en el campo remaining_amount_in_cents: (i) Si este es igual a 0, y el estado de la transacción es APPROVED esto indicará que el cliente realizó el pago total con Puntos y en este caso finaliza la transacción y se puede mostrar el resumen del pago. (ii) Si el valor es igual a 0, y el estado de la transacción es ERROR o DECLINED esto indicará que no se realizó redención de Puntos; en este caso puedes habilitar al cliente la opción de pagar el total de la transacción con un segundo medio de pago. (Paso 3) (iii) Si el valor es mayor a 0, debes habilitar la opción de pagar con segundo medio de pago el valor pendiente por pagar. (Paso 3)

Paso 3: Pago con segundo medio de pago
Si en el paso anterior se cumple la condición (ii) Pago total con segundo medio de pago o (iii) Pago de saldo restante con segundo medio de pago se deberá habilitar la selección del segundo medio de pago (Tarjetas de Crédito o Débito, Botón de Transferencia Bancolombia, Nequi o PSE) para pagar el valor restante (remaining_amount_in_cents). Una vez seleccionado el segundo medio de pago, se deberá crear una segunda transacción asociada a la creada en el Paso 1. Para esto debes seguir las indicaciones del medio de pago respectivo agregando en la petición el campo parent_transaction_id como se muestra a continuación:

Segundo medio de Pago con Tarjeta

{
  "payment_method": {
    "type": "CARD",
    "installments": 2, // Número de cuotas
    "token": "tok_prod_1_BBb749EAB32e97a2D058Dd538a608301" // Token de la tarjeta de crédito
  },
  "parent_transaction_id": "1929-1666902167-47609" // Transacción PCOL
  // Otros campos de la transacción a crear...
}

Segundo medio de Pago con Botón de Transferencia Bancolombia

{
  "payment_method": {
    "type": "BANCOLOMBIA_TRANSFER",
    "user_type": "PERSON", // Tipo de persona
    "payment_description": "Pago a Tienda Wompi", // Nombre de lo que se está pagando. Máximo 64 caracteres
    "ecommerce_url": "https://comercio.co/thankyou_page" // Permite al cliente omitir la pantalla resumen de la transacción de wompi, y redireccionar a un resumen personalizado current el comercio
  },
  "parent_transaction_id": "1929-1666902167-47609" // Transacción PCOL
  // Otros campos de la transacción a crear...
}


Segundo medio de Pago con Nequi

{
  "payment_method": {
    "type": "NEQUI"
    "phone_number": "3107654321" // Número celular de la cuenta Nequi
  },
  "parent_transaction_id": "1929-1666902167-47609" // Transacción PCOL
  // Otros campos de la transacción a crear...
}

Segundo medio de Pago con PSE

{
  "payment_method": {
    "type": "PSE",
    "user_type": 0, // Tipo de persona, natural (0) o jurídica (1)
    "user_legal_id_type": "CC", // Tipo de documento, CC o NIT
    "user_legal_id": "1099888777", // Número de documento
    "financial_institution_code": "1", // Código (`code`) de la institución financiera
    "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA", // Nombre de lo que se está pagando. Máximo 30 caracteres
    "ecommerce_url": "https://comercio.co/thankyou_page" // Permite al cliente omitir la pantalla resumen de la transacción de wompi, y redireccionar a un resumen personalizado current el comercio
  },
  "parent_transaction_id": "1929-1666902167-47609" // Transacción PCOL
  // Otros campos de la transacción a crear...
}


Por último, recuerda siempre verificar periódicamente el estado de una transacción en Wompi desde tu sistema usando el ID de transacción y nuestro API, con el endpoint GET /v1/transactions/<ID_DE_TRANSACCION>. Al consultar una transacción PCOL que tenga asociado un segundo medio de pago, encontrarás un campo llamado child_transaction_id dentro de un objeto extra, que estará dentro de la propiedad payment_method; este campo corresponde al identificador de la transacción del segundo medio de pago:

{
  "payment_method": {
    "type": "PCOL",
    "extra": {
      "points_redeemed": 0,
      "async_payment_url": "https://....",
      "external_identifier": "external-id-123",
      "remaining_amount_in_cents": 300000,
      "redeemed_amount_in_cents_pcol": 0,
      "child_transaction_id": "11463-1666651097-12919" // Transacción segundo medio de pago
    }
  }
}

De igual forma, al consultar la transacción asociada (child_transaction_id), encontrarás el identificador de la transacción PCOL:

{
  "payment_method": {
    "type": "NEQUI", // Segundo medio de pago
    "phone_number": "3222222222",
    "extra": {
      "parent_transaction_id": "11463-1666649502-97081" // Transacción PCOL
    }
}

BNPL Bancolombia
Dentro de la plataforma Wompi, brindamos a tus clientes la posibilidad de completar sus transacciones mediante un crédito de libre inversión proporcionado por BANCOLOMBIA, caracterizado por su atractiva tasa de interés del 0%. Este conveniente servicio permite a los usuarios disfrutar de la flexibilidad financiera al dividir el pago en 4 cuotas mensuales. Destacando su accesibilidad, este método de pago está disponible para transacciones con montos a partir de $100.000 pesos, garantizando así una experiencia financiera adaptada a diversas necesidades. Si deseas más información sobre esta opción de pago innovadora, te invitamos a encontrar detalles adicionales aquí.

Paso 1: Crea la transacción con Método de pago BNPL Bancolombia
Para crear una transacción de Pago con BNPL Bancolombia, los campos del método de pago deben ser similares a los siguientes:

{
  "amount_in_cents": 10000000, //$100.000 pesos en centavos
  "currency": "COP", // Tipo de moneda
  "customer_email": "myemail@mail.com", // Correo el cliente
  "reference": "{{REFERENCE}}", // Referencia creada por el comercio
  "payment_method": {
    "type": "BANCOLOMBIA_BNPL", // El metodo de pago
    "name": "Pedro", // Nombres del cliente
    "last_name": "Perez", // Apellidos del cliente
    "user_legal_id_type": "CC", // Tipo de documento del cliente
    "user_legal_id": "12345678", // Numero de documento del cliente
    "phone_number": "3222222222", // Telefono del cliente
    "phone_code": "+57", // Indicativo del cliente
    "redirect_url": "https://www.wompi.com", // URL de redirección despues de finalizar la experiencia BNPL
    "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
  },
  "acceptance_token": "{{ACCEPTANCE_TOKEN}}", // Token de aceptación
  "payment_method_type": "BANCOLOMBIA_BNPL" // El metodo de pago
}


Al crear la transacción, debes consultarla continuamente (long polling) hasta que ésta contenga un campo llamado url dentro de un objeto extra, que estará dentro de la propiedad payment_method. Una vez la obtengas, debes redireccionar a tu cliente a esta URL para entrar a la experiencia BNPL Bancolombia. El campo que debes esperar de la transacción se ve como el siguiente:

{
  "data": {
    "id": "12041-1701116325-63662",
    "created_at": "2023-11-27T20:18:45.527Z",
    "finalized_at": null,
    "amount_in_cents": 50000000,
    "reference": "wvnofptru4s",
    "currency": "COP",
    "payment_method_type": "BANCOLOMBIA_BNPL",
    "payment_method": {
      "name": "Pedro",
      "type": "BANCOLOMBIA_BNPL",
      "extra": {
        "url": "https://test.com", // <------ Campo URL
        "steps": ["ProvideAuthenticate"],
        "is_three_ds": false
      },
      "last_name": "Perez",
      "phone_code": "+57",
      "phone_number": "3222222222",
      "redirect_url": "https://www.wompi.com",
      "user_legal_id": "12345678",
      "user_legal_id_type": "CC",
      "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
    },
    "payment_link_id": null,
    "redirect_url": null,
    "status": "PENDING",
    "status_message": null,
    "merchant": {
      "id": 1,
      "name": "Test",
      "legal_name": "Test",
      "contact_name": "Test",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@wompi.com",
      "legal_id": "12345678",
      "public_key": "{{PUBLIC_KEY}}"
    },
    "taxes": [],
    "tip_in_cents": null
  },
  "meta": {}
}


Paso 2: Validar resultado de la transacción
Al finalizarse el proceso de redención a través de BNPL, éste redireccionará a la redirect_url que hayas especificado originalmente en la transacción, para que puedas verificar el resultado de la transacción al recibir la redirección se debe hacer nuevamente un long polling de la transacción hasta obtener en el campo status un valor diferente de PENDING:

{
  "data": {
    "id": "12041-1701116325-63662",
    "created_at": "2023-11-27T20:18:45.527Z",
    "finalized_at": null,
    "amount_in_cents": 50000000,
    "reference": "wvnofptru4s",
    "currency": "COP",
    "payment_method_type": "BANCOLOMBIA_BNPL",
    "payment_method": {
      "name": "Pedro",
      "type": "BANCOLOMBIA_BNPL",
      "extra": {
        "url": "https://test.com",
        "steps": ["ProvideAuthenticate"],
        "is_three_ds": false
      },
      "last_name": "Perez",
      "phone_code": "+57",
      "phone_number": "3222222222",
      "redirect_url": "https://www.wompi.com",
      "user_legal_id": "12345678",
      "user_legal_id_type": "CC",
      "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
    },
    "payment_link_id": null,
    "redirect_url": null,
    "status": "APPROVED", // <------ Status
    "status_message": null,
    "merchant": {
      "id": 1,
      "name": "Test",
      "legal_name": "Test",
      "contact_name": "Test",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@wompi.com",
      "legal_id": "12345678",
      "public_key": "{{PUBLIC_KEY}}"
    },
    "taxes": [],
    "tip_in_cents": null
  },
  "meta": {}
}


Daviplata
Dentro de la plataforma Wompi, ofrecemos a tus clientes la posibilidad de facilitar sus pagos al utilizar su cuenta Daviplata. Este servicio brinda una alternativa conveniente para completar transacciones de manera eficiente. Aprovechando la facilidad de uso de Daviplata, tus clientes pueden realizar pagos de manera sencilla y adaptada a su estilo de vida financiero.

Para utilizar este método de pago, se requiere solicitar al cliente el tipo y número de documento, así como asegurar una cobertura telefónica. Además, el cliente debe tener la aplicación instalada en su celular. El sistema realizará una búsqueda y enviará un código OTP a través de un mensaje de texto al número de teléfono asociado a los dos campos mencionados anteriormente, con el propósito de confirmar la transacción.

Paso 1: Crea la transacción con Método de pago Daviplata
Para iniciar una transacción de pago con Daviplata, es necesario que los campos de la transacción se ajusten a la siguiente estructura:

{
  "amount_in_cents": 150000, //Monto en centavos ($1.500 pesos)
  "currency": "COP", //Tipo de moneda
  "customer_email": "test@test.com", //Correo del cliente
  "reference": "{{REFERENCE}}", //Referencia creada por el comercio
  "payment_method": {
    "type": "DAVIPLATA", //Metodo de pago
    "user_legal_id": "1134568019", //Numero de documento del cliente
    "user_legal_id_type": "CC", //Tipo de documento del cliente
    "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
  },
  "acceptance_token": "{{ACCEPTANCE_TOKEN}}", //Token de aceptación
  "payment_method_type": "DAVIPLATA", //Metodo de pago
  "redirect_url": "https://www.google.com" //Campo opcional: URL de redirección al finalizar la transacción.
}


Al crear la transacción, es necesario realizar consultas continuas (long polling) hasta que la misma incluya un campo denominado url, el cual estará ubicado en la propiedad data -> payment_method -> extra -> url:

{
  "data": {
    "id": "12518-1707838356-68178",
    "created_at": "2024-02-13T15:32:37.046Z", //Fecha de creación
    "finalized_at": null,
    "amount_in_cents": 150000, //Monto en centavos ($1.500 pesos)
    "reference": "6lmmyl8howq", //Referencia creada por el comercio
    "currency": "COP", //Moneda
    "payment_method_type": "DAVIPLATA", //Metodo de pago
    "payment_method": {
      "type": "DAVIPLATA", //Metodo de pago
      "extra": {
        "url": "https://test.com", //URL interfaz Wompi para digitar codigo OTP
        "steps": ["Create"],
        "is_three_ds": false,
        "afe_decision": "FRAUD_CHECK",
        "url_services": {
          //Servicios para implementar el reenvio y confirmación del OTP
          "token": "token", //JSON Token
          "code_otp_send": "https://test.com", //URL para reenviar el codigo OTP
          "code_otp_validate": "https://test.com" //URL para validar el codigo OTP
        }
      },
      "user_legal_id": "53234234", //Número de documento del cliente
      "user_legal_id_type": "CC", //Tipo de documento del cliente
      "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
    },
    "payment_link_id": null,
    "redirect_url": "https://www.test.com", //URL de redirección al concluir la transacción (si se especifica)
    "status": "PENDING", //Estado de la transacción
    "status_message": null,
    "merchant": {
      //Informacion del comercio
      "id": 999,
      "name": "test",
      "legal_name": "Pepito Perez",
      "contact_name": "Pepito Perez",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@gmail.com",
      "legal_id": "32452341",
      "public_key": "public_key" //Llave publica del comercio
    },
    "taxes": [] //Impuestos
  },
  "meta": {}
}


Utilizando nuestra experiencia
Una vez que obtengas esta información, debes redirigir a tu cliente hacia la URL correspondiente para acceder a la experiencia que ofrecemos, donde podrá insertar el código OTP de confirmación, dicha experiencia luce de la siguiente manera:

otp daviplata

Aplicando tu experiencia
Esta vez nos centramos en el JSON data -> payment_method -> extra -> url_services. Aquí encontrarás los siguientes campos:

token: Este debes enviarlo como token Bearer en tus Headers.
code_otp_send: Se emplea para reenviar un código OTP al cliente. Para utilizarlo, debes realizar una solicitud tipo POST. No olvides incluir el token Bearer en tus encabezados Headers. En caso de una solicitud exitosa, la respuesta será la siguiente:
{
  "status": 200,
  "code": "OK",
  "message": "Solicitud ejecutada correctamente.",
  "data": {
    "transaction": {
      "PK": "12518-1707777099-36709", //Identificador de la transacción
      "status": "PENDING", //Estado de la transacción
      "statusMessage": "",
      "amountInCents": 150000, //Monto en centavos ($1.500 pesos)
      "clientInfo": {
        "typeDocument": "CC", // Tipo de documento pagador
        "numberDocument": "1043843543", // Numero de documento pagador
        "email": "test@sandbox.com" // Correo del pagador
      },
      "steps": {
        "PurchaseIntention": [
          {
            "fechaExpiracionToken": "2024-02-13T15:03:08.272-05:00", //Fecha expiracion OTP
            "idSessionToken": "24748382" //Identificador OTP
          },
          {
            "fechaExpiracionToken": "2024-02-13T15:16:15.744-05:00", //Fecha expiracion OTP
            "idSessionToken": "19935125" //Identificador OTP
          }
        ]
      },
      "redirectUrl": "https://www.google.com", //URL de redirección al concluir la transacción (si se especifica)
      "createdAt": "2024-02-12T22:31:57.903Z", //Fecha de creación
      "updatedAt": "2024-02-12T22:32:11.975Z" //Fecha de modificación
    },
    "authorization": {
      "access_token": "access_token" //Nuevo token de acceso
    },
    "attempts": {
      "currentSendCode": 2, //Número de veces que has solicitado el reénvio de codigo OTP
      "limitSendCode": 2, //Número de veces que puedes solicitar el codigo OTP
      "currentValidateCode": 0, //Número de veces que has confirmado el OTP
      "limitValidateCode": 2 //Número de veces que puedes confirmar el OTP
    }
  }
}


IMPORTANTE
Cuando realizas un reenvío de código OTP, antes de hacer la petición para validar el nuevo código OTP, debes actualizar tu token Bearer en la cabecera, utilizando el nuevo access_token que se encuentra en el campo JSON authorization de la solicitud code_otp_send.

code_otp_validate: Esta función te permite enviar el código OTP que el cliente ha ingresado para confirmar la transacción. Para validar el OTP, realiza una solicitud tipo POST asegurándote de incluir el token Bearer en los encabezados Headers y un cuerpo JSON, como se muestra a continuación:
{
  "code": 123456
}

En caso de una petición exitosa, la respuesta será la siguiente:

{
  "status": 200,
  "meta": {
    "trace_id": "5d9eb010-c9f7-11ee-aaec-a50d7c8df505"
  },
  "code": "OK",
  "message": "Solicitud ejecutada correctamente.",
  "data": {
    "transaction": {
      "PK": "12518-1707777099-36709", //Identificador de la transacción
      "status": "PENDING", //Estado de la transacción
      "statusMessage": "",
      "amountInCents": 1500000, //Monto en centavos ($1.500 pesos)
      "clientInfo": {
        "typeDocument": "CC", // Tipo de documento pagador
        "numberDocument": "1043843543", // Numero de documento pagador
        "email": "test@sandbox.com" // Correo del pagador
      },
      "steps": {
        "PurchaseIntention": [
          {
            "fechaExpiracionToken": "2024-02-12T17:35:11.554-05:00",
            "idSessionToken": "93016224"
          }
        ],
        "ConfirmIntention": [
          {
            "idTransaccionAutorizador": "000000368995", //ID Authorizador
            "estado": "Aprobado", //Estado final de la transacción (DAVIPLATA)
            "fechaTransaccion": "2024-02-13T14:55:56", //Fecha finalización transacción
            "numAprobacion": "452341" //Numero de aprobación
          }
        ]
      },
      "redirectUrl": "https://www.test.com", //URL de redirección al concluir la transacción (si se especifica)
      "createdAt": "2024-02-12T22:31:57.903Z", //Fecha de creación
      "updatedAt": "2024-02-12T22:37:56.592Z" //Fecha de modificación
    },
    "authorization": {
      "access_token": "access_token" //Token de acceso
    },
    "attempts": {
      "currentSendCode": 1, //Número de veces que has solicitado el reénvio de codigo OTP
      "limitSendCode": 2, //Número de veces que puedes solicitar el codigo OTP
      "currentValidateCode": 1, //Número de veces que has confirmado el OTP
      "limitValidateCode": 2 //Número de veces que puedes confirmar el OTP
    }
  }
}


Paso 2: Validar resultado de la transacción
Una vez finalizado el proceso de redención a través de Daviplata, serás redirigido a la redirect_url que hayas especificado al crear la transacción (en caso de haberla definido) o a nuestra interfaz. En este punto, podrás verificar el estado final de la transacción. Si has especificado una redirect_url al crear la transacción, se aconseja realizar un long polling continuo hasta que la transacción alcance un estado final:

{
  "data": {
    "id": "12518-1707854036-89959",
    "created_at": "2024-02-13T19:53:56.879Z", //Fecha de creación
    "finalized_at": "2024-02-13T19:55:58.000Z", //Fecha de finalización
    "amount_in_cents": 150000, //Monto en centavos ($1.500 pesos)
    "reference": "zieemgxkai", //Referencia
    "currency": "COP", //Moneda
    "payment_method_type": "DAVIPLATA", //Metodo de pago
    "payment_method": {
      "type": "DAVIPLATA", //Metodo de pago
      "extra": {
        "url": "https://test.com", //URL interfaz Wompi para digitar codigo OTP
        "steps": [
          "ConfirmIntention",
          "ConfirmIntention",
          "PurchaseIntention",
          "Create"
        ],
        "is_three_ds": false,
        "afe_decision": "FRAUD_CHECK",
        "url_services": {
          //Servicios Daviplata
          "token": "token", //JSON Token
          "code_otp_send": "https://test.com", //URL para reenviar el codigo OTP
          "code_otp_validate": "https://test.com" //URL para validar el codigo OTP
        },
        "external_identifier": "452341", //Numero de aprobación
        "daviplata_transaction_id": "452341" //Numero de aprobación
      },
      "user_legal_id": "53234234", //Número de documento del cliente
      "user_legal_id_type": "CC", //Tipo de documento del cliente
      "payment_description": "Pago a Tienda Wompi, ref: JD38USJW2XPLQA" // Nombre de lo que se está pagando. Máximo 30 caracteres
    },
    "payment_link_id": null,
    "redirect_url": null, //URL de redirección al concluir la transacción (si se especifica)
    "status": "APPROVED", //Estado de la transacción
    "status_message": null,
    "merchant": {
      //Informacion del comercio
      "id": 999,
      "name": "test",
      "legal_name": "Pepito Perez",
      "contact_name": "Pepito Perez",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@gmail.com",
      "legal_id": "32452341",
      "public_key": "public_key" //Llave publica del comercio
    },
    "taxes": [] //Impuestos
  },
  "meta": {}
}


Suscripción Daviplata
Wompi es una plataforma de pagos que facilita las transacciones electrónicas, ofreciendo diversas funcionalidades para los usuarios. Una de las opciones disponibles es la suscripción con Daviplata, la cual se puede utilizar de tres formas distintas para mayor comodidad y eficiencia:

1. Pago favorito
Wompi permite a los usuarios seleccionar Daviplata como su método de pago favorito. Esto significa que cada vez que realices una transacción, no necesitarás ingresar nuevamente los detalles de tu cuenta Daviplata.

Ventajas

Ahorro de tiempo en futuras transacciones.
Mayor comodidad al no tener que ingresar los detalles de pago repetidamente.
Seguridad al utilizar un método de pago confiable.
2. Débito automático
Wompi también ofrece la opción de configurar pagos recurrentes automáticamente desde tu cuenta Daviplata. Esta función es ideal para suscripciones y servicios que requieren pagos periódicos.

Ventajas

Garantiza que los pagos se realicen puntualmente.
Elimina la necesidad de recordar fechas de pago.
Facilita la gestión de tus finanzas personales.
3. Pago favorito y débito automático
La combinación de pago favorito y débito automático te ofrece lo mejor de ambos mundos: comodidad y automatización. Al configurar Daviplata como tu método de pago favorito y activar el débito automático, te aseguras de que los pagos recurrentes se realicen automáticamente utilizando tu método de pago preferido.

Ventajas

Simplificación máxima del proceso de pago.
Automatización de pagos recurrentes con tu método de pago preferido.
Mayor tranquilidad al saber que los pagos se gestionan de manera eficiente y segura.
Si quieres saber como funciona el API de esta funcionalidad podrás consultarlo en Fuentes de pago & Tokenización: Cuentas DaviPlata

SU+ PAY
Ofrecemos a tus clientes la posibilidad de comprar productos o servicios y pagarlos en cuotas. Este servicio es la solución perfecta para quienes buscan flexibilidad y eficiencia en la gestión de sus pagos. Esta innovadora opción de pago permite a los clientes distribuir el costo de sus compras en múltiples pagos, facilitando así la adquisición de bienes y servicios sin la necesidad de un desembolso inicial completo.

Para hacer uso de este medio de pago, es necesario que el cliente tenga una cuenta SU+ Pay y un cupo disponible. Las compras deben ser mayores a $35,000 e inferiores a $5,000,000. El cliente seleccionará la cantidad de cuotas al momento de la compra, y el sistema gestionará automáticamente los pagos periódicos según las cuotas seleccionadas. Esto es especialmente útil para compras de mayor valor, permitiendo a los clientes planificar sus finanzas de manera más efectiva.

Para confirmar las compras, el cliente recibirá un código OTP (One-Time Password) que deberá ingresar para autorizar la transacción. Esto asegura una capa adicional de seguridad en cada compra, garantizando que solo el titular de la cuenta pueda aprobar los pagos.

Esta facilidad no solo mejora la experiencia de compra para el cliente, sino que también asegura a los negocios un flujo constante de ingresos con menor esfuerzo administrativo.

Paso 1: Crea la transacción con método de pago SU+ PAY
Para iniciar una transacción de pago con SU+ PAY, es necesario que los campos de la transacción se ajusten a la siguiente estructura:

{
  "amount_in_cents": 3500000, //Monto en centavos ($35.000 pesos)
  "currency": "COP", //Tipo de moneda
  "customer_email": "test@test.com", //Correo del cliente
  "reference": "{{REFERENCE}}", //Referencia creada por el comercio
  "payment_method": {
    "type": "SU_PLUS", //Metodo de pago
    "user_legal_id_type": "CC", //Tipo de documento del cliente
    "user_legal_id": "1284952" //Numero de documento del cliente
  },
  "acceptance_token": "{{ACCEPTANCE_TOKEN}}", //Token de aceptación
  "payment_method_type": "SU_PLUS", //Metodo de pago
  "redirect_url": "https://www.google.com" //Campo opcional: URL de redirección al finalizar la transacción.
}


Después de la creación de la transacción, es necesario realizar consultas continuas (long polling) hasta que la misma incluya un campo denominado URL, ubicado en la propiedad data -> payment_method -> extra -> url. Deberas redirigir a tu cliente a esta URL para que interactúe con la experiencia de usuario de SU+ Pay. Allí, podrá visualizar el resumen del crédito, elegir el número de cuotas y confirmar la compra ingresando el código OTP que se le enviará a su número de teléfono.

{
  "data": {
    "id": "12518-1707838356-68178",
    "created_at": "2024-02-13T15:32:37.046Z", //Fecha de creación
    "finalized_at": null,
    "amount_in_cents": 350000, //Monto en centavos ($35.000 pesos)
    "reference": "6lmmyl8howq", //Referencia creada por el comercio
    "currency": "COP", //Moneda
    "payment_method_type": "SU_PLUS", //Metodo de pago
    "payment_method": {
      "type": "SU_PLUS",
      "extra": {
        "url": "https://public-assets.dev.wompi.dev/sandbox_su_plus/index.html?transaction_id=11004-1719319279-86121&external_api_url=https://api-sandbox.co.dev.wompi.dev/v1&url_redirect=https://transaction-redirect.dev.wompi.dev/check&code_approved=964734&code_declined=799133&code_cancel=304456&code_error=540140", //URL experiencia SU+ PAY
        "steps": ["Create"],
        "is_three_ds": false
      },
      "user_legal_id": "1084869583", //Número de documento del pagador
      "user_legal_id_type": "CC" //Tipo de documento del pagador
    },
    "payment_link_id": null,
    "redirect_url": "https://www.test.com", //URL de redirección al concluir la transacción (si se especifica)
    "status": "PENDING", //Estado de la transacción
    "status_message": null,
    "merchant": {
      //Informacion del comercio
      "id": 999,
      "name": "test",
      "legal_name": "Pepito Perez",
      "contact_name": "Pepito Perez",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@gmail.com",
      "legal_id": "32452341",
      "public_key": "public_key" //Llave publica del comercio
    },
    "taxes": [] //Impuestos
  },
  "meta": {}
}


Paso 2: Validar resultado de la transacción
Una vez finalizado el proceso de redención a través de SU+ PAY, serás redirigido a la redirect_url que hayas especificado al crear la transacción (en caso de haberla definido) o a nuestra interfaz. En este punto, podrás verificar el estado final de la transacción. Si has especificado una redirect_url al crear la transacción, se aconseja realizar un long polling continuo hasta que la transacción alcance un estado final:

{
  "data": {
    "id": "12518-1707854036-89959",
    "created_at": "2024-02-13T19:53:56.879Z", //Fecha de creación
    "finalized_at": "2024-02-13T19:55:58.000Z", //Fecha de finalización
    "amount_in_cents": 3500000, //Monto en centavos ($35.000 pesos)
    "reference": "zieemgxkai", //Referencia
    "currency": "COP", //Moneda
    "payment_method_type": "SU_PLUS", //Metodo de pago
    "payment_method": {
      "type": "SU_PLUS", //Metodo de pago
      "extra": {
        "url": "https://public-assets.dev.wompi.dev/sandbox_su_plus/index.html?transaction_id=11004-1719319279-86121&external_api_url=https://api-sandbox.co.dev.wompi.dev/v1&url_redirect=https://transaction-redirect.dev.wompi.dev/check&code_approved=964734&code_declined=799133&code_cancel=304456&code_error=540140", // Interfaz SU+ PAY
        "steps": ["Create"],
        "is_three_ds": false,
        "external_identifier": "4c701f2d-5f2f-4a09-9722-5f71a5cd7c32",
        "su_plus_transaction_id": "4c701f2d-5f2f-4a09-9722-5f71a5cd7c32"
      },
      "user_legal_id": "1084869583",
      "user_legal_id_type": "CC"
    },
    "payment_link_id": null,
    "redirect_url": null, //URL de redirección al concluir la transacción (si se especifica)
    "status": "APPROVED", //Estado de la transacción
    "status_message": null,
    "merchant": {
      //Informacion del comercio
      "id": 999,
      "name": "test",
      "legal_name": "Pepito Perez",
      "contact_name": "Pepito Perez",
      "phone_number": "+573222222222",
      "logo_url": null,
      "legal_id_type": "CC",
      "email": "test@gmail.com",
      "legal_id": "32452341",
      "public_key": "public_key" //Llave publica del comercio
    },
    "taxes": [] //Impuestos
  },
  "meta": {}
}