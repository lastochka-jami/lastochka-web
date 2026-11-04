export default function Loading() {
  return (
    <div className="brand-loading" role="status" aria-live="polite">
      <img
        className="brand-mark brand-loading-mark"
        src="/images/brand-icon-v2.webp"
        alt=""
        width={72}
        height={72}
      />
      <span>Загружаем…</span>
    </div>
  );
}
