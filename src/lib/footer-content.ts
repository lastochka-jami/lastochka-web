// Verified against the landing page and public support page, 2026-11-06.
export interface AppSettingsContacts {
  contacts?: {
    phones?: string[];
    socialNetworks?: { name: string; url: string }[];
    appLinks?: { appStore?: string | null; googlePlay?: string | null; ruStore?: string | null };
  };
}

const approved = {
  telegram: 'https://t.me/lastochka_djami2',
  vk: 'https://vk.com/lastochka.djami',
  appStore: 'https://apps.apple.com/ru/app/id6758952125',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.app.lastochka.djami',
  appGallery: 'https://appgallery.huawei.com/#/app/C118601879',
};

export const documentLinks = [
  ['Публичная оферта', 'https://lastochki.store/offer'],
  ['Пользовательское соглашение', 'https://lastochki.store/terms'],
  ['Политика конфиденциальности', 'https://lastochki.store/privacy'],
  ['Согласие на обработку персональных данных', 'https://lastochki.store/personal-data-consent'],
  ['Удаление аккаунта', 'https://lastochki.store/account-deletion'],
] as const;
export const supportUrl = 'https://lastochki.store/support';

export function footerContent(settings?: AppSettingsContacts | null) {
  const contacts = settings?.contacts;
  // Only use verified destinations. New settings URLs need verification before publication.
  const social = (url: string) => contacts?.socialNetworks?.find(item => item.url === url)?.url ?? url;
  const app = (key: 'appStore' | 'googlePlay') => contacts?.appLinks?.[key] === approved[key] ? contacts.appLinks[key]! : approved[key];
  // The unlabelled phones array may also contain legal contacts; don't infer their purpose.
  const phone = contacts?.phones?.find(value => value.replace(/[^+0-9]/g, '') === '+79640306644') ?? '+7 964 030-66-44';
  return {
    phone,
    phoneHref: 'tel:+79640306644',
    apps: [
      { name: 'App Store', href: app('appStore'), icon: 'apple' },
      { name: 'Google Play', href: app('googlePlay'), icon: 'google' },
      { name: 'AppGallery', href: approved.appGallery, icon: 'huawei' },
    ],
    socials: [ { name: 'Telegram', href: social(approved.telegram) }, { name: 'ВКонтакте', href: social(approved.vk) } ],
  };
}
