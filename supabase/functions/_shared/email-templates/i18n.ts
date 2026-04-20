/**
 * Bilingual (EN/FR) string tables for auth email templates.
 *
 * Each template imports the namespace it needs and selects the correct
 * locale at render time via the `locale` prop ('en' | 'fr').
 *
 * Adding a new locale: add it to the `Locale` union below and a sibling
 * key in every namespace. TypeScript will flag any incomplete coverage.
 */

export type Locale = 'en' | 'fr';

export const pickLocale = (input: unknown): Locale =>
  input === 'fr' ? 'fr' : 'en';

const brand = {
  en: 'Kang Open Banking — Kang Standard for Innovation',
  fr: "Kang Open Banking — Le standard Kang pour l'innovation",
};

export const signup = {
  en: {
    preview: 'Confirm your email — Kang Open Banking',
    h1: 'Confirm your email',
    intro: (siteName: string) => `Thank you for signing up for ${siteName}!`,
    confirmAddress: 'Please confirm your email address',
    byClicking: 'by clicking the button below:',
    cta: 'Verify Email',
    orPaste: 'Or copy and paste this link into your browser:',
    ignore: "If you didn't create an account, you can safely ignore this email.",
    brand: brand.en,
  },
  fr: {
    preview: 'Confirmez votre adresse e-mail — Kang Open Banking',
    h1: 'Confirmez votre adresse e-mail',
    intro: (siteName: string) => `Merci de vous être inscrit à ${siteName} !`,
    confirmAddress: 'Veuillez confirmer votre adresse e-mail',
    byClicking: 'en cliquant sur le bouton ci-dessous :',
    cta: 'Vérifier mon e-mail',
    orPaste: 'Ou copiez ce lien dans votre navigateur :',
    ignore: "Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
    brand: brand.fr,
  },
};

export const recovery = {
  en: {
    preview: 'Reset your password — Kang Open Banking',
    h1: 'Reset your password',
    body: 'We received a request to reset your Kang Open Banking account password. Click the button below to choose a new password.',
    cta: 'Reset Password',
    ignore: "If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.",
    brand: brand.en,
  },
  fr: {
    preview: 'Réinitialisez votre mot de passe — Kang Open Banking',
    h1: 'Réinitialisez votre mot de passe',
    body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Kang Open Banking. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
    cta: 'Réinitialiser le mot de passe',
    ignore: "Si vous n'avez pas demandé de réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe restera inchangé.",
    brand: brand.fr,
  },
};

export const magicLink = {
  en: {
    preview: 'Your secure login link — Kang Open Banking',
    h1: 'Your secure login link',
    body: 'Click the button below to securely sign in to your Kang account. This link will expire shortly.',
    cta: 'Sign In',
    orPaste: 'Or copy and paste this link into your browser:',
    ignore: "If you didn't request this link, you can safely ignore this email.",
    brand: brand.en,
  },
  fr: {
    preview: 'Votre lien de connexion sécurisé — Kang Open Banking',
    h1: 'Votre lien de connexion sécurisé',
    body: 'Cliquez sur le bouton ci-dessous pour vous connecter à votre compte Kang en toute sécurité. Ce lien expirera prochainement.',
    cta: 'Se connecter',
    orPaste: 'Ou copiez ce lien dans votre navigateur :',
    ignore: "Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet e-mail.",
    brand: brand.fr,
  },
};

export const invite = {
  en: {
    preview: "You've been invited to join Kang Open Banking",
    h1: "You've been invited",
    body: "You've been invited to join",
    bodyTail: 'Click the button below to accept the invitation and create your account.',
    cta: 'Accept Invitation',
    ignore: "If you weren't expecting this invitation, you can safely ignore this email.",
    brand: brand.en,
  },
  fr: {
    preview: 'Vous êtes invité à rejoindre Kang Open Banking',
    h1: 'Vous êtes invité',
    body: 'Vous avez été invité à rejoindre',
    bodyTail: 'Cliquez sur le bouton ci-dessous pour accepter et créer votre compte.',
    cta: "Accepter l'invitation",
    ignore: "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail.",
    brand: brand.fr,
  },
};

export const emailChange = {
  en: {
    preview: 'Confirm your email change — Kang Open Banking',
    h1: 'Confirm your email change',
    intro: 'You requested to change your Kang account email from',
    to: 'to',
    clickToConfirm: 'Click the button below to confirm this change:',
    cta: 'Confirm Email Change',
    secure: "If you didn't request this change, please secure your account immediately.",
    brand: brand.en,
  },
  fr: {
    preview: 'Confirmez le changement de votre adresse e-mail — Kang Open Banking',
    h1: 'Confirmez le changement de votre adresse e-mail',
    intro: "Vous avez demandé à changer l'adresse e-mail de votre compte Kang de",
    to: 'vers',
    clickToConfirm: 'Cliquez sur le bouton ci-dessous pour confirmer ce changement :',
    cta: 'Confirmer le changement',
    secure: "Si vous n'êtes pas à l'origine de cette demande, sécurisez immédiatement votre compte.",
    brand: brand.fr,
  },
};

export const reauthentication = {
  en: {
    preview: 'Your verification code — Kang Open Banking',
    h1: 'Verify your identity',
    body: 'Use the code below to confirm your identity on Kang:',
    expiry: 'This code will expire shortly. Do not share it with anyone.',
    secure: "If you didn't request this code, please secure your account immediately.",
    brand: brand.en,
  },
  fr: {
    preview: 'Votre code de vérification — Kang Open Banking',
    h1: 'Vérifiez votre identité',
    body: 'Utilisez le code ci-dessous pour confirmer votre identité sur Kang :',
    expiry: 'Ce code expirera prochainement. Ne le partagez avec personne.',
    secure: "Si vous n'avez pas demandé ce code, sécurisez immédiatement votre compte.",
    brand: brand.fr,
  },
};
