export class LocalDataUnavailableError extends Error {
  constructor() {
    super('Connect to download this data.');
    this.name = 'LocalDataUnavailableError';
  }
}
