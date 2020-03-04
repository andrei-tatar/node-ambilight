import { readFile, writeFile } from 'fs';
import { isEqual } from 'lodash';
import { homedir } from 'os';
import { join } from 'path';
import { concat, defer, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, publishReplay, refCount } from 'rxjs/operators';
import { promisify } from 'util';

import { Settings } from './common';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const configFile = join(homedir(), '.node-ambilight');
const configSaved$ = new Subject<Settings>();

export const config$ = concat(
    defer(() => readConfig()),
    configSaved$,
).pipe(
    publishReplay(1),
    refCount(),
);

export function configMap<T>(select: (config: Settings) => T): Observable<T> {
    return config$.pipe(
        map(select),
        distinctUntilChanged((a, b) => isEqual(a, b)),
    );
}

export async function updateConfig(updater: (config: Settings) => Settings): Promise<void> {
    let config = await readConfig();
    config = updater(config) ?? config;
    await writeConfig(config);
    configSaved$.next(config);
}

async function readConfig(): Promise<Settings> {
    try {
        const data = await readFileAsync(configFile);
        const json = data.toString();
        return JSON.parse(json);
    } catch (err) {
        return {
            gamma: [2.2, 2.2, 2.2],
            capture: {
                size: { width: 640, height: 480 },
                fps: 30,
            },
            resolution: {
                horizontal: 52,
                vertical: 31,
            },
            samplePoints: [],
            coordinates: {
                top: {
                    from: { x: 25, y: 25 },
                    to: { x: 75, y: 25 },
                    q: { x: 50, y: 25 },
                },
                right: {
                    from: { x: 75, y: 25 },
                    to: { x: 75, y: 75 },
                    q: { x: 75, y: 50 },
                },
                bottom: {
                    from: { x: 75, y: 75 },
                    to: { x: 25, y: 75 },
                    q: { x: 50, y: 75 },
                },
                left: {
                    from: { x: 25, y: 75 },
                    to: { x: 25, y: 25 },
                    q: { x: 25, y: 50 },
                },
            },
            blendRatio: .7,
        };
    }
}

async function writeConfig(config: Settings): Promise<void> {
    const json = JSON.stringify(config, null, 2);
    await writeFileAsync(configFile, json);
}