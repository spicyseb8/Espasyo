import type { ReactNode } from "react";

import { cn } from "cn";
import {
  LEGAL_DOCUMENTS,
  getReadingMinutes,
  sectionId,
  type LegalBlock,
  type LegalContactRow,
  type LegalDocument,
  type LegalDocumentData,
  type LegalSection,
} from "./LegalDocuments";

export type { LegalDocument } from "./LegalDocuments";

const BODY_TEXT = "text-justify hyphens-auto text-[15px] leading-7 text-foreground/80";
const LINK = "font-medium underline underline-offset-4 hover:text-primary";

function DocumentHeader({ data }: { data: LegalDocumentData }) {
  return (
    <header className="mb-8">
      <p className="text-sm text-muted-foreground">{data.organization}</p>
      <h3 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
        {data.title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>Effective {data.effective}</span>
        {data.version && <span>Version {data.version}</span>}
        <span>{getReadingMinutes(data.id)} min read</span>
      </div>
    </header>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className={cn("space-y-2", BODY_TEXT)}>
      {items.map(item => (
        <li
          key={item}
          className="relative pl-5 before:absolute before:left-0 before:top-[0.8em] before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-foreground/40"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function contactValue(row: LegalContactRow): ReactNode {
  if (row.kind === "email") {
    return (
      <a href={`mailto:${row.value}`} className={LINK}>
        {row.value}
      </a>
    );
  }
  if (row.kind === "phone") {
    return (
      <a href={`tel:${row.value.replace(/\s/g, "")}`} className={LINK}>
        {row.value}
      </a>
    );
  }
  return row.value;
}

function ContactCard({ rows }: { rows: LegalContactRow[] }) {
  return (
    <dl className="space-y-3 rounded-xl bg-muted/50 p-4 text-sm sm:p-5">
      {rows.map(row => (
        <div key={row.label} className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{contactValue(row)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderBlock(block: LegalBlock, index: number) {
  switch (block.type) {
    case "p":
      return (
        <p key={index} className={BODY_TEXT}>
          {block.lead && (
            <>
              <strong className="font-semibold text-foreground">{block.lead}</strong>{" "}
            </>
          )}
          {block.text}
        </p>
      );
    case "list":
      return <BulletList key={index} items={block.items} />;
    case "contact":
      return <ContactCard key={index} rows={block.rows} />;
  }
}

function SectionView({
  document,
  n,
  section,
}: {
  document: LegalDocument;
  n: number;
  section: LegalSection;
}) {
  const id = sectionId(document, n);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-6", section.callout && "rounded-xl bg-muted/60 p-5 sm:p-6")}
    >
      <h4
        id={`${id}-title`}
        className="flex items-baseline gap-2 text-base font-semibold leading-snug text-foreground sm:gap-3 sm:text-[1.0625rem]"
      >
        <span className="shrink-0 font-medium tabular-nums text-muted-foreground sm:w-7">
          {n}.
        </span>
        <span className="min-w-0">{section.title}</span>
      </h4>
      <div className="mt-3 space-y-3 sm:pl-10">{section.blocks.map(renderBlock)}</div>
    </section>
  );
}

export function LegalDocumentContent({ document }: { document: LegalDocument }) {
  const data = LEGAL_DOCUMENTS[document] ?? LEGAL_DOCUMENTS.terms;

  return (
    <article>
      <DocumentHeader data={data} />

      <div className="mb-10 space-y-4 text-justify hyphens-auto text-base leading-7 text-foreground">
        {data.intro.map(paragraph => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="space-y-9">
        {data.sections.map((section, index) => (
          <SectionView key={section.title} document={data.id} n={index + 1} section={section} />
        ))}
      </div>

      <p className="mt-14 text-center text-sm text-muted-foreground">End of {data.navTitle}</p>
    </article>
  );
}