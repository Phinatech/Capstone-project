/** The frame around every page: sidebar, menus, footer, quick actions and sign-in extras. */
export const en = {
  'shell.collapseSidebar': 'Collapse sidebar',
  'shell.expandSidebar': 'Expand sidebar',
  'shell.sidebar': 'Sidebar',
  'shell.primary': 'Primary',
  'shell.breadcrumb': 'Breadcrumb',
  'shell.version': 'Version {version}',
  'shell.authTagline': 'Reputation-weighted oracle · Sepolia testnet',
  'quick.evaluate': 'Evaluate policy #{id}',
  'quick.queue': 'Evaluation queue',
  'quick.backtest': 'Run backtest',
  'auth.digit': 'Digit {n}',
  'forgot.demoNote': 'Demo mode: the reset link is shown above as well as being emailed.',
  'sales.readFailed': 'The sales ledger could not be read.',
  'error.rateLimited': 'Too many attempts. Wait a few minutes and try again.',
  'error.alreadyVerified': 'This email is already verified.',
  'error.invalidRole': 'Choose farmer or field agent.',
  'error.server': 'Something went wrong on our side. Please try again.',
  'error.googleUnavailable': 'Google sign-in is not available right now. Sign in with your email and password instead.',
  'sales.saveFailed': 'The receipt could not be saved.'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'shell.collapseSidebar': 'Ninke gefen shafi',
  'shell.expandSidebar': 'Buɗe gefen shafi',
  'shell.sidebar': 'Gefen shafi',
  'shell.primary': 'Babban kewayawa',
  'shell.breadcrumb': 'Hanyar shafi',
  'shell.version': 'Siga {version}',
  'shell.authTagline': 'Oracle mai auna amincewa · Sepolia testnet',
  'quick.evaluate': 'Tantance inshora #{id}',
  'quick.queue': 'Jerin tantancewa',
  'quick.backtest': 'Gudanar da gwaji',
  'auth.digit': 'Lamba ta {n}',
  'forgot.demoNote': 'Yanayin gwaji: ana nuna hanyar saitawa a sama, kuma an aika ta imel.',
  'sales.readFailed': 'Ba a iya karanta littafin siyarwa ba.',
  'error.rateLimited': 'An yi ƙoƙari da yawa. Jira ’yan mintuna sannan sake gwadawa.',
  'error.alreadyVerified': 'An riga an tabbatar da wannan imel.',
  'error.invalidRole': 'Zaɓi manomi ko wakilin filin aiki.',
  'error.server': 'Wani abu ya faru a ɓangarenmu. Da fatan za a sake gwadawa.',
  'error.googleUnavailable': 'Shiga da Google ba ya aiki a yanzu. Shiga da imel da kalmar sirri maimakon haka.',
  'sales.saveFailed': 'Ba a iya ajiye rasitin ba.'
};

export const fr: Strings = {
  'shell.collapseSidebar': 'Réduire la barre latérale',
  'shell.expandSidebar': 'Déplier la barre latérale',
  'shell.sidebar': 'Barre latérale',
  'shell.primary': 'Navigation principale',
  'shell.breadcrumb': 'Fil d’Ariane',
  'shell.version': 'Version {version}',
  'shell.authTagline': 'Oracle pondéré par la réputation · réseau de test Sepolia',
  'quick.evaluate': 'Évaluer la police n° {id}',
  'quick.queue': 'File d’évaluation',
  'quick.backtest': 'Lancer le backtest',
  'auth.digit': 'Chiffre {n}',
  'forgot.demoNote': 'Mode démo : le lien est affiché ci-dessus en plus d’être envoyé par e-mail.',
  'sales.readFailed': 'Le registre des ventes n’a pas pu être lu.',
  'error.rateLimited': 'Trop de tentatives. Patientez quelques minutes puis réessayez.',
  'error.alreadyVerified': 'Cet e-mail est déjà vérifié.',
  'error.invalidRole': 'Choisissez agriculteur ou agent de terrain.',
  'error.server': 'Un problème est survenu de notre côté. Veuillez réessayer.',
  'error.googleUnavailable': 'La connexion Google est indisponible pour le moment. Connectez-vous avec votre e-mail et votre mot de passe.',
  'sales.saveFailed': 'Le reçu n’a pas pu être enregistré.'
};
