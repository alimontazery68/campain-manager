import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  outputFileTracingRoot:require('node:path').resolve(__dirname,'../..'),
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'X-Frame-Options',value:'DENY'}]}];},
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_INTERNAL_URL || `http://127.0.0.1:${process.env.API_PORT || 4000}`}/:path*` }];
  },
};
export default nextConfig;
