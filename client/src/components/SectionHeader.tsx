export function SectionHeader({
  title,
  description,
  meta
}: {
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {meta ? <span className="section-meta">{meta}</span> : null}
    </div>
  );
}
