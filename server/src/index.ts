import bodyParser from 'body-parser';
import express from 'express';
import cv from 'opencv4nodejs';
import { join } from 'path';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { bufferTime, delay, first, map, retryWhen, switchMap, tap, withLatestFrom } from 'rxjs/operators';

import { blendSample } from './blend';
import { frames$ } from './capture';
import { correctRange } from './correct';
import { tvOn$ } from './mqtt';
import { sampleFrame } from './sample';
import { config$, updateConfig } from './settings';
import { updater$ } from './updater';

const sample$ = frames$.pipe(
    sampleFrame(),
);
const fps$ = new BehaviorSubject<number>(0);
const sampleCorrected$ = sample$.pipe(
    blendSample(),
    correctRange(),
);
const subscription = tvOn$.pipe(
    switchMap(on => on
        ? sampleCorrected$
            .pipe(
                withLatestFrom(updater$),
                switchMap(([sample, updater]) => updater.update(sample)),
                bufferTime(5000),
                map(items => items.length / 5),
                tap(fps => fps$.next(fps)),
            )
        : EMPTY),
    retryWhen(err$ => err$.pipe(
        tap(err => console.warn(err)),
        delay(5000)
    )),
).subscribe();

const app = express();
app.use(bodyParser.json());
const api = express.Router();
api.get('/frame', async (_req, res) => {
    const frame = await frames$.pipe(first()).toPromise();
    const buffer = await cv.imencodeAsync('.png', frame);
    res.type('png').end(buffer);
});
api.get('/fps', async (_req, res) => {
    const fps = await fps$.pipe(first()).toPromise();
    res.json({ fps });
});
api.get('/samples', async (_req, res) => {
    const samples = await sample$.pipe(first()).toPromise();
    const array = Array.from(samples);
    res.json(array);
});
api.get('/settings', async (_req, res) => {
    const config = await config$.pipe(first()).toPromise();
    res.json(config);
});
api.patch('/settings', async (req, res) => {
    await updateConfig(cfg => ({ ...cfg, ...req.body }));
    res.status(204).send();
    console.info('updated settings');
});

app.use('/api', api);
app.use(express.static(join(__dirname, 'client')));

const server = app.listen(3000, () => {
    console.info('server started');
});
process.on('SIGINT', () => {
    subscription.unsubscribe();
    server.close();
});
