import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/conta", "/carrinho", "/checkout", "/pedido", "/api", "/monte-seu-oculos", "/cookies", "/*?*"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
