import mqtt from 'mqtt';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';

import { configMap } from './settings';

const mqttSettings = configMap(c => c.mqtt);
export const tvOn$ = mqttSettings.pipe(
    switchMap(cfg => cfg
        ? new Observable<boolean>(observer => {
            const onvalue = cfg.onvalue ?? 'on';
            const topic = cfg.topic ?? 'ambilight/power';

            const client = mqtt.connect(cfg.endpoint, {
                username: cfg.user,
                password: cfg.password,
            });

            client.on('connect', () => {
                client.subscribe(topic, err => {
                    if (err) observer.error(err);
                });
            });

            client.on('message', (_topic, message) => {
                observer.next(message.toString() === onvalue);
            });

            return () => client.end();
        })
        : of(true)),
    startWith(false),
    distinctUntilChanged(),
);