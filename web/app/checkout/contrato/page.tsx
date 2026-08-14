'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PreparedContract, prepareContract, signContract } from '@/lib/checkout-actions';
import styles from './page.module.scss';

function Contract() {
  const router = useRouter();
  const orderId = useSearchParams().get('order');

  const [signer, setSigner] = useState({ fullName: '', documentId: '', phone: '' });
  const [contract, setContract] = useState<PreparedContract | null>(null);
  const [opened, setOpened] = useState(false);
  const [read, setRead] = useState(false);
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!orderId) {
    return (
      <div className={styles.contract}>
        <p>Este enlace no lleva a ningún pedido.</p>
      </div>
    );
  }

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await prepareContract(orderId!, {
      fullName: signer.fullName.trim(),
      documentId: signer.documentId.trim(),
      phone: signer.phone.trim(),
    });

    setWorking(false);
    if (result.ok) setContract(result.data);
    else setError(result.error);
  }

  async function sign(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    const result = await signContract(contract!.contractId, {
      otpChallengeId: contract!.otpChallengeId,
      code: code.trim(),
      scrolledToEnd: read,
    });

    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }

    router.push(`/checkout/pagar?order=${orderId}`);
  }

  const signerComplete =
    signer.fullName.trim().length > 2 &&
    signer.documentId.trim().length > 4 &&
    signer.phone.trim().length > 6;

  if (!contract) {
    return (
      <div className={styles.contract}>
        <h1 className="label muted">Contrato de compraventa</h1>
        <p>
          Estos datos van en el documento que vas a firmar, así que tienen que coincidir
          con tu cédula.
        </p>

        <form onSubmit={prepare} className={styles.form}>
          <label htmlFor="fullName">Nombre completo</label>
          <input
            id="fullName"
            value={signer.fullName}
            onChange={(e) => setSigner({ ...signer, fullName: e.target.value })}
            autoComplete="name"
            required
          />

          <label htmlFor="documentId">Cédula</label>
          <input
            id="documentId"
            value={signer.documentId}
            onChange={(e) => setSigner({ ...signer, documentId: e.target.value })}
            inputMode="numeric"
            required
          />

          <label htmlFor="phone">Teléfono</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            value={signer.phone}
            onChange={(e) => setSigner({ ...signer, phone: e.target.value })}
            autoComplete="tel"
            required
          />

          {error && <p role="alert" className={styles.error}>{error}</p>}

          <button type="submit" disabled={working || !signerComplete}>
            {working ? 'Preparando…' : 'Ver el contrato'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.contract}>
      <h1 className="label muted">Firma el contrato</h1>

      <p>
        Te enviamos un código de seis dígitos a tu correo. Lee el documento y fírmalo con
        ese código.
      </p>

      {/* Served through this site, not from storage: the stored link never
          expires and opens a document with your ID number in it. */}
      <a
        className={styles.document}
        href={`/contratos/${contract.contractId}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
      >
        Abrir el contrato (PDF)
      </a>

      <p className="muted label">
        Huella del documento: {contract.documentHash.slice(0, 16)}…
      </p>

      <form onSubmit={sign} className={styles.form}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={read}
            onChange={(e) => setRead(e.target.checked)}
            disabled={!opened}
          />
          Leí el contrato completo y estoy de acuerdo
        </label>

        {!opened && (
          <p className="muted">Abre el documento para poder confirmarlo.</p>
        )}

        <label htmlFor="code">Código</label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
        />

        {error && <p role="alert" className={styles.error}>{error}</p>}

        <button type="submit" disabled={working || !read || code.length !== 6}>
          {working ? 'Firmando…' : 'Firmar y continuar al pago'}
        </button>
      </form>

      <p className="muted">
        Firmas antes de pagar. Si el pago no se completa, el contrato queda anulado.
      </p>
    </div>
  );
}

export default function ContractPage() {
  return (
    <Suspense fallback={<div className={styles.contract} />}>
      <Contract />
    </Suspense>
  );
}
