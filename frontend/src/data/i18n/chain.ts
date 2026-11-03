/** Connecting to the chain, and why a transaction did not go through. */
export const en = {
  'chain.connecting': 'Connecting to the chain',
  'chain.reading': 'Reading the contracts',
  'chain.mainnet': 'Ethereum mainnet',
  'chain.sepolia': 'the Sepolia testnet',
  'chain.other': 'chain {id}',
  'chainErr.notFinalized': "The oracles haven't finalized every dekad in this window yet, so it can't be settled.",
  'chainErr.salesClosed': 'Sales for this coverage window have closed.',
  'chainErr.poolShort': "The payout pool can't cover this payout right now.",
  'chainErr.alreadySettled': 'This policy has already been settled.',
  'chainErr.wrongPremium': "The premium sent didn't match the contract's quote.",
  'chainErr.insufficient':
    "The wallet says this account can't cover the premium plus gas. If MetaMask is showing a different account with funds, switch back to it or reload the page so the app picks up the account you're using now.",
  'chainErr.noReason':
    "The node couldn't say why the transaction failed. Usually the wallet's RPC is busy, or this account doesn't cover the premium plus gas. Check the balance in MetaMask, wait a moment, then try again.",
  'chainErr.networkChanged': 'MetaMask changed networks while the page was open. Reload the page on the right network and try again.',
  'chainErr.failed': 'The transaction failed.',
  'chainErr.switchedTitle': 'MetaMask switched networks',
  'chainErr.switchedBody': 'This app trades on {expected}. Switch MetaMask back before buying cover, or a purchase would go out on {actual}.',
  'chainErr.wrongChain':
    'MetaMask is on {actual}, but this purchase belongs on {expected}. Switch MetaMask to {expected} and try again: confirming now would send funds on the wrong chain. If MetaMask already shows {expected}, its link to this page is stale: restart the browser, then reload.',
  'chainErr.notOnSale': 'This coverage window is not on sale on the contract.',
  'chainErr.lowBalance':
    '{account} holds {balance} ETH on Sepolia, which does not cover the {premium} ETH premium plus gas. Send Sepolia ETH to that account and try again.',
  'chainErr.buyNeedsWallet': 'Buying cover on this network needs a browser wallet. Connect MetaMask and try again.',
  'chainErr.settleNeedsWallet': 'Settling on this network needs a browser wallet. Connect MetaMask and try again.',
  'chainErr.apiFailed': 'Failed to fetch data from the API'
} as const;

type Strings = Record<keyof typeof en, string>;

export const ha: Strings = {
  'chain.connecting': 'Ana haɗawa da blockchain',
  'chain.reading': 'Ana karanta kwangiloli',
  'chain.mainnet': 'Ethereum mainnet',
  'chain.sepolia': 'Sepolia testnet',
  'chain.other': 'blockchain {id}',
  'chainErr.notFinalized': 'Oracles ba su kammala duk dekad na wannan lokacin ba tukuna, don haka ba za a iya kammala shi ba.',
  'chainErr.salesClosed': 'An rufe sayar da wannan lokacin kariya.',
  'chainErr.poolShort': 'Asusun biyan kuɗi ba zai iya biyan wannan kuɗin a yanzu ba.',
  'chainErr.alreadySettled': 'An riga an kammala wannan inshora.',
  'chainErr.wrongPremium': 'Kuɗin inshora da aka aika bai yi daidai da farashin kwangilar ba.',
  'chainErr.insufficient':
    'Walat ta ce wannan asusun ba zai iya biyan kuɗin inshora da kuɗin gas ba. Idan MetaMask na nuna wani asusu mai kuɗi, koma gare shi ko sake loda shafin don manhajar ta ɗauki asusun da kuke amfani da shi yanzu.',
  'chainErr.noReason':
    'Node bai iya faɗin dalilin da ma’amalar ta gaza ba. Yawanci RPC na walat yana da cunkoso, ko kuma asusun bai isa ya biya kuɗin inshora da gas ba. Duba kuɗin da ke MetaMask, jira ɗan lokaci, sannan sake gwadawa.',
  'chainErr.networkChanged': 'MetaMask ya canza network yayin da shafin ke buɗe. Sake loda shafin a kan network ɗin da ya dace sannan sake gwadawa.',
  'chainErr.failed': 'Ma’amalar ta gaza.',
  'chainErr.switchedTitle': 'MetaMask ya canza network',
  'chainErr.switchedBody': 'Wannan manhaja tana aiki a {expected}. Mayar da MetaMask kafin sayen inshora, in ba haka ba saye zai tafi a {actual}.',
  'chainErr.wrongChain':
    'MetaMask yana kan {actual}, amma wannan saye na {expected} ne. Canza MetaMask zuwa {expected} sannan sake gwadawa: tabbatarwa yanzu zai aika kuɗi a network mara kyau. Idan MetaMask ya riga ya nuna {expected}, haɗinsa da wannan shafin ya tsufa: sake kunna burauza, sannan sake lodawa.',
  'chainErr.notOnSale': 'Ba a sayar da wannan lokacin kariya a kwangilar.',
  'chainErr.lowBalance':
    '{account} yana da ETH {balance} a Sepolia, wanda bai isa ya biya kuɗin inshora ETH {premium} da gas ba. Aika Sepolia ETH zuwa wannan asusun sannan sake gwadawa.',
  'chainErr.buyNeedsWallet': 'Sayen inshora a wannan network yana buƙatar walat na burauza. Haɗa MetaMask sannan sake gwadawa.',
  'chainErr.settleNeedsWallet': 'Kammala inshora a wannan network yana buƙatar walat na burauza. Haɗa MetaMask sannan sake gwadawa.',
  'chainErr.apiFailed': 'Ba a iya samun bayanai daga uwar garke ba'
};

export const fr: Strings = {
  'chain.connecting': 'Connexion à la blockchain',
  'chain.reading': 'Lecture des contrats',
  'chain.mainnet': 'le réseau principal Ethereum',
  'chain.sepolia': 'le réseau de test Sepolia',
  'chain.other': 'la chaîne {id}',
  'chainErr.notFinalized': 'Les oracles n’ont pas encore finalisé toutes les décades de cette période : elle ne peut pas être réglée.',
  'chainErr.salesClosed': 'Les ventes de cette période sont closes.',
  'chainErr.poolShort': 'La réserve ne peut pas couvrir cette indemnité pour le moment.',
  'chainErr.alreadySettled': 'Cette police a déjà été réglée.',
  'chainErr.wrongPremium': 'La prime envoyée ne correspond pas au devis du contrat.',
  'chainErr.insufficient':
    'Le portefeuille indique que ce compte ne couvre pas la prime plus les frais de gas. Si MetaMask affiche un autre compte approvisionné, revenez-y ou rechargez la page pour que l’application prenne le compte utilisé.',
  'chainErr.noReason':
    'Le nœud n’a pas pu expliquer l’échec. En général, le RPC du portefeuille est saturé ou le compte ne couvre pas la prime plus le gas. Vérifiez le solde dans MetaMask, patientez, puis réessayez.',
  'chainErr.networkChanged': 'MetaMask a changé de réseau pendant que la page était ouverte. Rechargez la page sur le bon réseau et réessayez.',
  'chainErr.failed': 'La transaction a échoué.',
  'chainErr.switchedTitle': 'MetaMask a changé de réseau',
  'chainErr.switchedBody': 'Cette application opère sur {expected}. Revenez-y dans MetaMask avant de souscrire, sinon l’achat partirait sur {actual}.',
  'chainErr.wrongChain':
    'MetaMask est sur {actual}, mais cet achat se fait sur {expected}. Passez MetaMask sur {expected} et réessayez : confirmer maintenant enverrait les fonds sur la mauvaise chaîne. Si MetaMask affiche déjà {expected}, sa connexion à cette page est périmée : redémarrez le navigateur, puis rechargez.',
  'chainErr.notOnSale': 'Cette période n’est pas en vente sur le contrat.',
  'chainErr.lowBalance':
    '{account} détient {balance} ETH sur Sepolia, ce qui ne couvre pas la prime de {premium} ETH plus le gas. Envoyez des ETH Sepolia sur ce compte et réessayez.',
  'chainErr.buyNeedsWallet': 'Souscrire sur ce réseau nécessite un portefeuille dans le navigateur. Connectez MetaMask et réessayez.',
  'chainErr.settleNeedsWallet': 'Régler sur ce réseau nécessite un portefeuille dans le navigateur. Connectez MetaMask et réessayez.',
  'chainErr.apiFailed': 'Impossible de récupérer les données de l’API'
};
