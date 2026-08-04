import { JsonLd } from "@/components/JsonLd";
import type { FaqItem } from "@/lib/faq-content";

export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
        คำถามที่พบบ่อย
      </h2>
      <div className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
        {items.map((item) => (
          <details key={item.question} className="group py-3">
            <summary className="cursor-pointer list-none font-medium text-gray-900 marker:content-none dark:text-gray-50">
              {item.question}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }}
      />
    </section>
  );
}
