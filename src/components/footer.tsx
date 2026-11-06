import Link from 'next/link';
import { HomeBrandLink } from './home-brand-link';
import { AppSettingsContacts, documentLinks, footerContent, supportUrl } from '@/lib/footer-content';

const appIcons = [
<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.365 1.43c0 1.14-.43 2.23-1.13 3.05-.78.92-2.06 1.62-3.13 1.55-.13-1.1.42-2.27 1.13-3.06.81-.9 2.16-1.6 3.13-1.54zM20.5 17.05c-.53 1.22-.78 1.77-1.45 2.85-.94 1.5-2.27 3.37-3.92 3.39-1.46.02-1.84-.95-3.83-.94-1.99.01-2.4.96-3.86.94-1.65-.02-2.91-1.71-3.85-3.21-2.62-4.18-2.9-9.08-1.28-11.7 1.15-1.86 2.97-2.95 4.69-2.95 1.74 0 2.83.96 4.27.96 1.4 0 2.25-.96 4.27-.96 1.53 0 3.15.83 4.31 2.27-3.78 2.07-3.16 7.47.65 9.35z"/></svg>,
<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3.5 2.3c-.3.3-.5.7-.5 1.2v17c0 .5.2.9.5 1.2l9.5-9.7-9.5-9.7zm10.7 10.9l2.6 2.7L5 22.5c-.2.1-.3.1-.5.1l9.7-9.4zm0-2.4L4.5 1.4c.2 0 .3 0 .5.1l11.8 6.6-2.6 2.7zm6.2 1.2l-2.7 1.5-2.9-3 2.9-3 2.7 1.5c1 .6 1 2.4 0 3z"/></svg>,
<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M7.5 16c0-3.6 2-6.5 4.5-6.5s4.5 2.9 4.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M9.3 9.2C9.8 7.9 10.8 7 12 7s2.2.9 2.7 2.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
];

export function Footer({ settings }: { settings?: AppSettingsContacts | null }) {
  const content = footerContent(settings);
  return (
    <footer className="container footer" aria-label="Информация о магазине">
      <div className="footer-grid">
        <div className="footer-identity">
          <HomeBrandLink className="footer-brand" imageSize={30}><span>Ласточка Джами</span></HomeBrandLink>
          <p>Всё любимое — рядом</p>
          <nav className="footer-socials" aria-label="Социальные сети">
            {content.socials.map(item => <a key={item.name} href={item.href}>{item.name}</a>)}
          </nav>
        </div>
        <nav className="footer-group" aria-labelledby="footer-buyers">
          <h2 id="footer-buyers">Покупателям</h2>
          <Link href="/faq">Вопросы и ответы</Link>
          <Link href="/info">Информация и контакты</Link>
          <a href={supportUrl}>Поддержка</a>
        </nav>
        <nav className="footer-group" aria-labelledby="footer-apps">
          <h2 id="footer-apps">Наше приложение</h2>
          <div className="footer-apps">
            {content.apps.map((app, index) => (
              <a key={app.name} className="footer-app-badge" href={app.href} aria-label={`Скачать в ${app.name}`}>
                {appIcons[index]}<span><small>Скачать в</small><strong>{app.name}</strong></span>
              </a>
            ))}
          </div>
        </nav>
        <section className="footer-group" aria-labelledby="footer-contacts">
          <h2 id="footer-contacts">Контакты</h2>
          <a href={content.phoneHref}>{content.phone}</a>
          <p><span className="footer-label">Поддержка</span>пн–сб, 9:00–18:00</p>
          <address>Нальчик, ул. Калинина, 76</address>
        </section>
      </div>
      <div className="footer-legal">
        <nav aria-label="Документы">{documentLinks.map(([name, href]) => <a key={href} href={href}>{name}</a>)}</nav>
        <p>© {new Date().getFullYear()} Ласточка Джами</p>
        <p>Продавец: ИП Хапова Лариса Аслануковна<br />ИНН 071510449657 · ОГРНИП 326070000013802</p>
      </div>
    </footer>
  );
}
