import React from "react";

export function JsonLd() {
  const schemaData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Legible",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "NGN",
        "category": "Free Tier available"
      },
      "description": "Turn photos of handwritten student notes into clean, structured digital books with AI transcription and PDF export.",
      "featureList": [
        "AI Handwriting Transcription",
        "Automatic Chapter Grouping",
        "Flagged Low-Confidence Review",
        "PDF Book Export"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Legible",
      "url": "https://legible.app",
      "logo": "https://legible.app/favicon.svg",
      "sameAs": []
    }
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  );
}
