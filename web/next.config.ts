import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },

  /**
   * Hosts allowed to load this dev server's internal assets.
   *
   * Without this, opening the site through a tunnel gets the page but every
   * `/_next/*` request answers 403 — the scripts never arrive, so nothing that
   * runs in the browser works and the cart looks broken for no visible reason.
   *
   * It applies to `next dev` only. A tunnel is how a payment provider is given
   * a public address to return to while the site still runs on this machine.
   */
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.io'],
};

export default config;
