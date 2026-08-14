/**
 * Every email the shop sends, in one place.
 *
 * Built as inline-styled tables because that is what mail clients render
 * reliably: Outlook ignores much of modern CSS, and Gmail strips a <style>
 * block on some clients and keeps it on others. What looks like 2005 here is
 * the only thing that looks the same everywhere.
 *
 * Each message also carries a plain-text version. Mail without one is more
 * likely to be treated as spam, and it is what makes the local console log
 * readable — which is how the whole flow gets walked by hand.
 */

export interface Message {
  subject: string;
  html: string;
  text: string;
}

const INK = '#101010';
const MUTED = '#6b6b6b';
const LINE = '#e2e2e2';
const PAPER = '#fafafa';

/**
 * The frame every message shares.
 *
 * `preheader` is the line mail clients show next to the subject in the inbox.
 * Left out, they show the first words of the body — usually "Ver este correo
 * en el navegador" or a stray link.
 */
function frame(options: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Toryteler</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;font-size:1px;color:${PAPER};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${options.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:480px;background:#ffffff;border:1px solid ${LINE};">
        <tr>
          <td style="padding:32px 32px 24px 32px;">
            <div style="font:500 11px/1 -apple-system,Helvetica,Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};">
              Toryteler
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;font:400 15px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:${INK};">
${options.body}
          </td>
        </tr>
      </table>
      <div style="max-width:480px;padding:16px 8px;font:400 12px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:${MUTED};">
        Medellín, Colombia
      </div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** A block link that survives Outlook, which ignores padding on an anchor. */
function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background:${INK};">
      <a href="${url}" style="display:inline-block;padding:14px 28px;font:500 12px/1 -apple-system,Helvetica,Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function magicLink(url: string, minutes: number): Message {
  return {
    subject: 'Tu acceso a Toryteler',
    html: frame({
      preheader: `El enlace entra a tu cuenta y vence en ${minutes} minutos.`,
      body: `
<p style="margin:0 0 16px 0;">Aquí está tu entrada. No hay contraseña que recordar: este enlace te deja adentro.</p>
${button(url, 'Entrar')}
<p style="margin:0 0 16px 0;color:${MUTED};font-size:13px;">
  Vence en ${minutes} minutos y sirve una sola vez. Si no lo pediste, puedes ignorar este correo:
  sin abrirlo, no ocurre nada.
</p>
<p style="margin:0;color:${MUTED};font-size:12px;word-break:break-all;">
  Si el botón no funciona, copia esta dirección:<br>${url}
</p>`,
    }),
    text: [
      'Aquí está tu entrada a Toryteler.',
      '',
      url,
      '',
      `Vence en ${minutes} minutos y sirve una sola vez.`,
      'Si no lo pediste, puedes ignorar este correo.',
    ].join('\n'),
  };
}

export function signingCode(code: string, minutes: number): Message {
  return {
    subject: `${code} es tu código para firmar`,
    html: frame({
      preheader: `Tu código para firmar el contrato. Vence en ${minutes} minutos.`,
      body: `
<p style="margin:0 0 8px 0;">Tu código para firmar el contrato de compraventa:</p>
<div style="margin:20px 0;padding:20px;border:1px solid ${LINE};text-align:center;font:600 30px/1 -apple-system,Helvetica,Arial,sans-serif;letter-spacing:0.24em;color:${INK};">
  ${code}
</div>
<p style="margin:0 0 12px 0;color:${MUTED};font-size:13px;">
  Vence en ${minutes} minutos. Escríbelo en la página donde estás firmando.
</p>
<p style="margin:0;color:${MUTED};font-size:13px;">
  Si no estás firmando nada ahora mismo, alguien más está intentando usar tu correo:
  ignora este mensaje y el código no sirve para nada.
</p>`,
    }),
    // The code goes in the first line: that is what a phone shows in the
    // notification, and it saves opening the message at all.
    text: [
      `${code} es tu código para firmar el contrato.`,
      '',
      `Vence en ${minutes} minutos.`,
      'Si no estás firmando nada, ignora este correo.',
    ].join('\n'),
  };
}

export function purchaseConfirmed(options: { items: string[]; accountUrl: string }): Message {
  const list = options.items
    .map((item) => `<li style="margin:0 0 6px 0;">${item}</li>`)
    .join('\n');

  return {
    subject: 'Tu compra quedó confirmada',
    html: frame({
      preheader: 'Recibimos el pago. Esto es lo que compraste.',
      body: `
<p style="margin:0 0 16px 0;">Recibimos tu pago. Esto es lo que compraste:</p>
<ul style="margin:0 0 20px 0;padding-left:20px;">${list}</ul>
<p style="margin:0 0 16px 0;color:${MUTED};font-size:13px;">
  Si incluye una pieza física, el contrato firmado queda guardado en tu cuenta y te
  escribimos cuando salga el envío. Si incluye un video, recuerda que se ve una sola vez:
  al darle play empieza tu ventana.
</p>
${button(options.accountUrl, 'Ver mi compra')}`,
    }),
    text: [
      'Recibimos tu pago. Esto es lo que compraste:',
      ...options.items.map((item) => `- ${item}`),
      '',
      'Un video se ve una sola vez: al darle play empieza tu ventana.',
      options.accountUrl,
    ].join('\n'),
  };
}

export function refunded(reason: string, accountUrl: string): Message {
  return {
    subject: 'Te devolvimos el dinero',
    html: frame({
      preheader: reason,
      body: `
<p style="margin:0 0 16px 0;">${reason}</p>
<p style="margin:0 0 16px 0;">Te reembolsamos el valor completo. Según tu banco, puede tardar unos días en aparecer.</p>
${button(accountUrl, 'Ver mis pedidos')}`,
    }),
    text: [reason, '', 'Te reembolsamos el valor completo.', accountUrl].join('\n'),
  };
}
