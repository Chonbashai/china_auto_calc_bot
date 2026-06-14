export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class ManualInputRequiredError extends Error {
  constructor(
    message: string,
    public readonly field: 'yuanRate' | 'customs',
  ) {
    super(message);
    this.name = 'ManualInputRequiredError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
