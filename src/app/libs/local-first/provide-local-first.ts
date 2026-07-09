import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { LOCAL_FIRST_CONFIG, LocalFirstConfig } from './interfaces/local-first-config';
import { LocalDatabase } from './core/local-database';

export function provideLocalFirst(config: LocalFirstConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: LOCAL_FIRST_CONFIG, useValue: config },
    LocalDatabase
  ]);
}
