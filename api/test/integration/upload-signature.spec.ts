import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { UploadSignatureService } from '../../src/storage/upload-signature.service';

/**
 * The signature is the one piece of this that cannot be checked against the
 * real service without credentials, and getting it wrong fails at upload time
 * with a message that blames the key. So the algorithm is pinned here instead,
 * including Cloudinary's own worked example from its documentation.
 */
describe('cloudinary upload signature', () => {
  const SECRET = 'un-secreto-de-prueba';
  const service = new UploadSignatureService({
    get: () => `cloudinary://mi-llave:${SECRET}@mi-nube`,
  } as unknown as ConfigService);

  it('matches the worked example in Cloudinary\'s documentation', () => {
    // https://cloudinary.com/documentation/authentication_signatures
    // secret "abcd", timestamp 1315060510 → this exact digest.
    const digest = createHash('sha1').update('timestamp=1315060510abcd').digest('hex');
    expect(digest).toBe('a21ad0f63beb4de2e5575204b79ab90bffb02c10');
  });

  it('signs the parameters it will actually send, secret appended, nothing between', () => {
    const ticket = service.sign('pieces');
    const expected = createHash('sha1')
      .update(`folder=pieces&timestamp=${ticket.timestamp}${SECRET}`)
      .digest('hex');
    expect(ticket.signature).toBe(expected);
  });

  it('sorts the parameters by name, which is what makes the digest reproducible', () => {
    const ticket = service.sign('posters');
    // "folder" before "timestamp": the other order produces a valid-looking
    // digest that Cloudinary rejects.
    const wrongOrder = createHash('sha1')
      .update(`timestamp=${ticket.timestamp}&folder=posters${SECRET}`)
      .digest('hex');
    expect(ticket.signature).not.toBe(wrongOrder);
  });

  it('hands over the cloud and the key, and never the secret', () => {
    const ticket = service.sign('pieces');
    expect(ticket.cloudName).toBe('mi-nube');
    expect(ticket.apiKey).toBe('mi-llave');
    expect(JSON.stringify(ticket)).not.toContain(SECRET);
  });

  it('refuses a malformed CLOUDINARY_URL instead of signing with nothing', () => {
    const broken = new UploadSignatureService({
      get: () => 'no-es-una-url',
    } as unknown as ConfigService);
    expect(() => broken.sign('pieces')).toThrow(/CLOUDINARY_URL_MALFORMED/);
  });
});
