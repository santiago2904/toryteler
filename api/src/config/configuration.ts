import * as Joi from 'joi';

/**
 * Every variable the API needs, validated at boot. A missing secret must stop
 * the process, not surface as a confusing failure on the first payment.
 */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  SESSION_SECRET: Joi.string().min(32).required(),
  PUBLIC_WEB_URL: Joi.string().required(),

  WOMPI_PUBLIC_KEY: Joi.string().required(),
  WOMPI_PRIVATE_KEY: Joi.string().required(),
  WOMPI_INTEGRITY_SECRET: Joi.string().required(),
  WOMPI_EVENTS_SECRET: Joi.string().required(),
  WOMPI_BASE_URL: Joi.string().default('https://sandbox.wompi.co/v1'),
  WOMPI_CHECKOUT_URL: Joi.string().default('https://checkout.wompi.co/p/'),

  CLOUDINARY_URL: Joi.string().required(),
  CF_STREAM_ACCOUNT_ID: Joi.string().required(),
  CF_STREAM_TOKEN: Joi.string().required(),
  RESEND_API_KEY: Joi.string().required(),
}).unknown(true);
