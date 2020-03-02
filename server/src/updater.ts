import { EMPTY, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import WebSocket from 'ws';
import { configMap } from './settings';

export interface Updater {
    update(data: Uint8Array): Promise<void>;
}

const config$ = configMap(s => s.updater);

export const updater$ = config$.pipe(
    switchMap(config => {
        switch (config?.type) {
            case 'websocket':
                return new Observable<Updater>(observer => {
                    const ws = new WebSocket(config.endpoint);
                    ws.on('open', () => observer.next({
                        update: data => new Promise<void>((resolve, reject) =>
                            ws.send(data, err => {
                                if (err) reject(err); else resolve();
                            })
                        ),
                    }));
                    ws.on('error', err => observer.error(err));
                    ws.on('close', () => observer.complete());
                    return () => ws.close();
                });
            default:
                return EMPTY;
        }
    })
);