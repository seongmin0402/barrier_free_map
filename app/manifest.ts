import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "공주대학교 신관캠퍼스 베리어프리맵",
    short_name: "베리어프리맵",
    description:
      "장애인·노약자·임산부 등 이동약자를 위한 공주대학교 신관캠퍼스 접근성 지도",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
