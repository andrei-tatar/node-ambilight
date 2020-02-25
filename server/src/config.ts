import { readFile, writeFile } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { homedir } from 'os';
import { Subject } from 'rxjs';
import { startWith, switchMap, shareReplay } from 'rxjs/operators';

import { Settings } from './common';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const configFile = join(homedir(), '.node-ambilight');
const reload$ = new Subject();

export const config$ = reload$.pipe(
    startWith(null),
    switchMap(_ => readConfig()),
    shareReplay(1),
);

export async function updateConfig(updater: (config: Settings) => Settings): Promise<void> {
    let config = await readConfig();
    config = updater(config) ?? config;
    writeConfig(config);
    reload$.next();
}

async function readConfig(): Promise<Settings> {
    try {
        const data = await readFileAsync(configFile);
        const json = data.toString();
        return JSON.parse(json);
    } catch (err) {
        return {
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
                topLeft: { x: 25, y: 25 },
                topRight: { x: 75, y: 25 },
                bottomLeft: { x: 25, y: 75 },
                bottomRight: { x: 75, y: 75 },
                qTop: { x: 50, y: 25 },
                qLeft: { x: 25, y: 50 },
                qBottom: { x: 50, y: 75 },
                qRight: { x: 75, y: 50 },
            },
        };
    }
}

async function writeConfig(config: Settings): Promise<void> {
    const json = JSON.stringify(config, null, 2);
    await writeFileAsync(configFile, json);
}