import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    localPatterns: [
      {
        pathname: "/images/circuits/**",
      },
      {
        pathname: "/images/circuit-outlines/**",
      },
      {
        pathname: "/images/assets/achievments/**",
      },
      {
        pathname: "/logos/**",
      },
      {
        pathname: "/avatar-decorations/**",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "api.openf1.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.formula1.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
