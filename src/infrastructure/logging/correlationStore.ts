let _correlationId: string = crypto.randomUUID();

export function getCorrelationId(): string {
  return _correlationId;
}

export function resetCorrelationId(): void {
  _correlationId = crypto.randomUUID();
}
