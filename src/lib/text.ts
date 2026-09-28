/** Lower case without accents, so "deposito" finds "Depósito". */
export const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
