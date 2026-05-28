import { defaultTransportFactory } from '../transport-factory.js';
import { LocalTransportConnector } from './local-transport.js';
import { RemoteTransportConnector } from './remote-transport.js';

let defaultsRegistered = false;

export function registerDefaultTransports(): void {
    if (defaultsRegistered) return;
    defaultsRegistered = true;
    
    defaultTransportFactory.register('local', new LocalTransportConnector());
    defaultTransportFactory.register('remote', new RemoteTransportConnector());
}

export { LocalTransportConnector } from './local-transport.js';
export { RemoteTransportConnector } from './remote-transport.js';
