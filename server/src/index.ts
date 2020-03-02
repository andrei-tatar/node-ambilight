import bodyParser from 'body-parser';
import express from 'express';
import cv from 'opencv4nodejs';
import { EMPTY } from 'rxjs';
import { delay, first, retryWhen, switchMap, tap, withLatestFrom } from 'rxjs/operators';

import { blendSample } from './blend';
import { frames$ } from './capture';
import { applyGammaCorrection, correctRange } from './correct';
import { tvOn$ } from './mqtt';
import { sampleFrame } from './sample';
import { config$, updateConfig } from './settings';
import { updater$ } from './updater';

const sample$ = frames$.pipe(
    sampleFrame(),
);
const sampleCorrected$ = sample$.pipe(
    correctRange(),
    applyGammaCorrection(),
    blendSample(),
);
const subscription = tvOn$.pipe(
    switchMap(on => on
        ? sampleCorrected$
            .pipe(
                withLatestFrom(updater$),
                switchMap(([sample, updater]) => updater.update(sample)),
            )
        : EMPTY),
    retryWhen(err$ => err$.pipe(
        tap(err => console.warn(err)),
        delay(5000)
    )),
).subscribe();

const app = express();
app.use(bodyParser.json());
app.get('/frame', async (_req, res) => {
    const frame = await frames$.pipe(first()).toPromise();
    const buffer = await cv.imencodeAsync('.png', frame);
    res.type('png').end(buffer);
});
app.get('/samples', async (_req, res) => {
    const samples = await sample$.pipe(first()).toPromise();
    const array = Array.from(samples);
    res.json(array);
});
app.get('/settings', async (_req, res) => {
    const config = await config$.pipe(first()).toPromise();
    res.json(config);
});
app.patch('/settings', async (req, res) => {
    await updateConfig(cfg => ({ ...cfg, ...req.body }));
    res.status(204).send();
});
app.use(express.static('./src/client'));

const server = app.listen(3000);
process.on('SIGINT', () => {
    subscription.unsubscribe();
    server.close();
});
