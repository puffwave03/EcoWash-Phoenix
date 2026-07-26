import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

async function getMessages(locale: string) {
  const [{ default: common }, { default: contact }, { default: home }] = await Promise.all([
    import(`@/i18n/${locale}/common.json`),
    import(`@/i18n/${locale}/contact.json`),
    import(`@/i18n/${locale}/home.json`),
  ]);

  return {
    common,
    contact,
    home,
  };
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await getMessages(locale),
  };
});
