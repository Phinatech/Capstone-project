/** The frame around every page: sidebar, menus, footer, quick actions and sign-in extras. */
export const en = {
  'shell.collapseSidebar': 'Collapse sidebar',
  'shell.expandSidebar': 'Expand sidebar',
  'shell.sidebar': 'Sidebar',
  'shell.primary': 'Primary',
  'shell.breadcrumb': 'Breadcrumb',
  'shell.footer': 'BSc Software Engineering prototype · Chinemerem Judith Ugbo · Supervisor: Dr Aaron Izang · Sepolia testnet only.',
  'shell.version': 'Version {version}',
  'shell.authTagline': 'Reputation-weighted oracle · Sepolia testnet',
  'quick.evaluate': 'Evaluate policy #{id}',
  'quick.queue': 'Evaluation queue',
  'quick.backtest': 'Run backtest',
  'auth.digit': 'Digit {n}',
  'forgot.demoNote': 'Demo mode: the reset link is shown above as well as being emailed.',
  'sales.readFailed': 'The sales ledger could not be read.',
  'sales.saveFailed': 'The receipt could not be saved.'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'shell.collapseSidebar': 'Ninke gefen shafi',
  'shell.expandSidebar': 'Buɗe gefen shafi',
  'shell.sidebar': 'Gefen shafi',
  'shell.primary': 'Babban kewayawa',
  'shell.breadcrumb': 'Hanyar shafi',
  'shell.footer': 'Samfurin BSc Software Engineering · Chinemerem Judith Ugbo · Mai kulawa: Dr Aaron Izang · Sepolia testnet kaɗai.',
  'shell.version': 'Siga {version}',
  'shell.authTagline': 'Oracle mai auna amincewa · Sepolia testnet',
  'quick.evaluate': 'Tantance inshora #{id}',
  'quick.queue': 'Jerin tantancewa',
  'quick.backtest': 'Gudanar da gwaji',
  'auth.digit': 'Lamba ta {n}',
  'forgot.demoNote': 'Yanayin gwaji: ana nuna hanyar saitawa a sama, kuma an aika ta imel.',
  'sales.readFailed': 'Ba a iya karanta littafin siyarwa ba.',
  'sales.saveFailed': 'Ba a iya ajiye rasitin ba.'
};

export const fr: Strings = {
  'shell.collapseSidebar': 'Réduire la barre latérale',
  'shell.expandSidebar': 'Déplier la barre latérale',
  'shell.sidebar': 'Barre latérale',
  'shell.primary': 'Navigation principale',
  'shell.breadcrumb': 'Fil d’Ariane',
  'shell.footer': 'Prototype de licence en génie logiciel · Chinemerem Judith Ugbo · Encadrant : Dr Aaron Izang · réseau de test Sepolia uniquement.',
  'shell.version': 'Version {version}',
  'shell.authTagline': 'Oracle pondéré par la réputation · réseau de test Sepolia',
  'quick.evaluate': 'Évaluer la police n° {id}',
  'quick.queue': 'File d’évaluation',
  'quick.backtest': 'Lancer le backtest',
  'auth.digit': 'Chiffre {n}',
  'forgot.demoNote': 'Mode démo : le lien est affiché ci-dessus en plus d’être envoyé par e-mail.',
  'sales.readFailed': 'Le registre des ventes n’a pas pu être lu.',
  'sales.saveFailed': 'Le reçu n’a pas pu être enregistré.'
};
