/** An API key; `token` is the key an integration sends, and it never expires. */
export type ServiceAccount = {
  token: string;
  createdDate: string;
};

export type ServiceAccountsQuery = {
  page: number;
  size: number;
  sort: string;
};
